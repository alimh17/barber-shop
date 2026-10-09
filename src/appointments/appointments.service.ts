import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AppointmentStatus, UserRole } from '../generated/prisma/client.js';
import { AvailabilityService } from '../availability/availability.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SalonAccessService } from '../salons/salon-access.service.js';
import { CreateAdminAppointmentDto } from './dto/create-admin-appointment.dto.js';
import { CreateAppointmentDto } from './dto/create-appointment.dto.js';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto.js';
import { UpdateAppointmentDto } from './dto/update-appointment.dto.js';

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availabilityService: AvailabilityService,
    private readonly salonAccessService: SalonAccessService,
  ) {}

  /**
   * تشخیص خطای تداخل رزرو PostgreSQL.
   */
  private isAppointmentOverlapConstraintError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) {
      return false;
    }

    const candidate = error as {
      message?: unknown;
      meta?: {
        driverAdapterError?: {
          cause?: {
            code?: unknown;
            originalCode?: unknown;
            message?: unknown;
            originalMessage?: unknown;
          };
        };
      };
    };

    const cause = candidate.meta?.driverAdapterError?.cause;

    const messages = [candidate.message, cause?.message, cause?.originalMessage]
      .filter((value): value is string => typeof value === 'string')
      .join(' ');

    return /constraint\s+["']appointment_no_overlap["']/i.test(messages);
  }

  /**
   * رزرو توسط مشتری واردشده.
   * مشتری از توکن کاربر تعیین می‌شود؛
   * بنابراین مشتری نمی‌تواند برای شخص دیگری رزرو کند.
   */
  async create(userId: string, dto: CreateAppointmentDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return this.createForCustomer(customer.id, dto);
  }

  /**
   * رزرو از پنل ADMIN یا SUPER_ADMIN.
   * customerId در این مسیر شناسه رکورد Customer است.
   */
  async createForAdmin(
    userId: string,
    role: UserRole,
    dto: CreateAdminAppointmentDto,
  ) {
    // Authorize against the barber's salon before looking up customerId.
    // This prevents an admin without salon access from probing customer IDs.
    const barber = await this.prisma.barber.findUnique({
      where: { id: dto.barberId },
    });

    if (!barber) {
      throw new NotFoundException('Barber not found');
    }

    await this.salonAccessService.assertCanAccessSalon(
      userId,
      role,
      barber.salonId,
    );

    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return this.createForCustomer(customer.id, dto, {
      userId,
      role,
      authorizedSalonId: barber.salonId,
    });
  }

  /**
   * منطق مشترک ایجاد رزرو.
   * کنترل زمان، ساعت کاری، خدمت و تداخل در یک نقطه انجام می‌شود.
   */
  private async createForCustomer(
    customerId: string,
    dto: CreateAppointmentDto,
    accessContext?: {
      userId: string;
      role: UserRole;
      authorizedSalonId: string;
    },
  ) {
    const startAt = new Date(dto.startAt);

    if (Number.isNaN(startAt.getTime())) {
      throw new BadRequestException('Invalid startAt');
    }

    if (startAt <= new Date()) {
      throw new BadRequestException(
        'Appointment cannot be created in the past',
      );
    }

    const [barber, service] = await Promise.all([
      this.prisma.barber.findUnique({
        where: { id: dto.barberId },
      }),
      this.prisma.service.findUnique({
        where: { id: dto.serviceId },
      }),
    ]);

    if (!barber) {
      throw new NotFoundException('Barber not found');
    }

    if (!barber.isActive) {
      throw new ConflictException('Cannot book an inactive barber');
    }

    // Re-check authorization only if the barber's salon changed after the
    // initial authorization in createForAdmin.
    if (accessContext && barber.salonId !== accessContext.authorizedSalonId) {
      await this.salonAccessService.assertCanAccessSalon(
        accessContext.userId,
        accessContext.role,
        barber.salonId,
      );
    }

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    if (!service.isActive) {
      throw new ConflictException('Cannot book an inactive service');
    }

    if (barber.salonId !== service.salonId) {
      throw new BadRequestException(
        'Barber and service must belong to the same salon',
      );
    }

    const barberService = await this.prisma.barberService.findUnique({
      where: {
        barberId_serviceId: {
          barberId: barber.id,
          serviceId: service.id,
        },
      },
    });

    if (!barberService) {
      throw new ConflictException(
        'This barber does not provide the selected service',
      );
    }

    if (service.duration <= 0) {
      throw new ConflictException('Service duration must be greater than zero');
    }

    // بررسی ساعت کاری، روز تعطیل و مدت واقعی خدمت.
    const slotValidation = await this.availabilityService.validateBookingSlot({
      salonId: barber.salonId,
      barberId: barber.id,
      serviceId: service.id,
      startAt,
    });

    const endAt = slotValidation.endAt;

    // جلوگیری از تداخل با رزروهای فعال.
    const overlappingAppointment = await this.prisma.appointment.findFirst({
      where: {
        barberId: barber.id,
        status: {
          in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
        },
        startAt: {
          lt: endAt,
        },
        endAt: {
          gt: startAt,
        },
      },
    });

    if (overlappingAppointment) {
      throw new ConflictException('Barber is already booked during this time');
    }

    try {
      return await this.prisma.appointment.create({
        data: {
          salonId: barber.salonId,
          customerId,
          barberId: barber.id,
          serviceId: service.id,
          startAt,
          endAt,
          price: service.price,
          duration: service.duration,
          status: AppointmentStatus.PENDING,
          note: dto.note,
        },
        include: {
          customer: {
            include: {
              user: {
                select: {
                  id: true,
                  phone: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                },
              },
            },
          },
          barber: {
            include: {
              user: {
                select: {
                  id: true,
                  phone: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                },
              },
            },
          },
          service: true,
        },
      });
    } catch (error) {
      if (this.isAppointmentOverlapConstraintError(error)) {
        throw new ConflictException(
          'Barber is already booked during this time',
        );
      }

      throw error;
    }
  }

  /**
   * دریافت یک نوبت همراه با کنترل دسترسی سالن.
   */
  async findById(id: string, userId: string, role: UserRole) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        customer: {
          include: {
            user: {
              select: {
                id: true,
                phone: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          },
        },
        barber: {
          include: {
            user: {
              select: {
                id: true,
                phone: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          },
        },
        service: true,
        salon: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    await this.salonAccessService.assertCanAccessSalon(
      userId,
      role,
      appointment.salonId,
    );

    return appointment;
  }

  /**
   * دریافت فهرست نوبت‌ها:
   * ADMIN فقط سالن‌های دارای عضویت فعال را می‌بیند.
   * SUPER_ADMIN تمام سالن‌ها را می‌بیند.
   */
  async findAll(userId: string, role: UserRole) {
    const where =
      role === UserRole.SUPER_ADMIN
        ? {}
        : {
            salonId: {
              in: (
                await this.prisma.salonMembership.findMany({
                  where: {
                    userId,
                    isActive: true,
                  },
                  select: {
                    salonId: true,
                  },
                })
              ).map((membership) => membership.salonId),
            },
          };

    return this.prisma.appointment.findMany({
      where,
      orderBy: {
        startAt: 'asc',
      },
      include: {
        customer: {
          include: {
            user: {
              select: {
                id: true,
                phone: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          },
        },
        barber: {
          include: {
            user: {
              select: {
                id: true,
                phone: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          },
        },
        service: true,
        salon: true,
      },
    });
  }

  /**
   * ویرایش نوبت توسط مدیر سالن با اعتبارسنجی زمان، خدمت و دسترسی.
   */
  async update(
    id: string,
    dto: UpdateAppointmentDto,
    userId: string,
    role: UserRole,
  ) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    await this.salonAccessService.assertCanAccessSalon(
      userId,
      role,
      appointment.salonId,
    );

    if (
      appointment.status !== AppointmentStatus.PENDING &&
      appointment.status !== AppointmentStatus.CONFIRMED
    ) {
      throw new ConflictException(
        `Cannot edit an appointment with status ${appointment.status}`,
      );
    }

    const barberId = dto.barberId ?? appointment.barberId;
    const serviceId = dto.serviceId ?? appointment.serviceId;
    const startAt = dto.startAt === undefined
      ? appointment.startAt
      : new Date(dto.startAt);

    if (Number.isNaN(startAt.getTime())) {
      throw new BadRequestException('Invalid startAt');
    }

    // Detect actual scheduling changes, not merely fields present in the DTO.
    // Clients may submit the full form even when only the note was edited.
    // Compare the effective values after applying the same nullish fallbacks
    // used by the update below. Optional null IDs therefore behave like omitted
    // fields instead of being misclassified as scheduling changes.
    const isScheduleChanged =
      startAt.getTime() !== appointment.startAt.getTime() ||
      barberId !== appointment.barberId ||
      serviceId !== appointment.serviceId;

    // Allow edits that do not actually change scheduling details on older
    // appointments, but never reschedule one into the past or alter its
    // scheduling details after its start time.
    if (isScheduleChanged && startAt <= new Date()) {
      throw new BadRequestException('Appointment cannot be scheduled in the past');
    }

    // A note-only edit must not revalidate a historical time slot against
    // today's availability rules (working hours, days off, or active records).
    if (!isScheduleChanged) {
      const result = await this.prisma.appointment.updateMany({
        where: {
          id,
          updatedAt: appointment.updatedAt,
          status: appointment.status,
        },
        data: { ...(dto.note !== undefined ? { note: dto.note } : {}) },
      });

      if (result.count === 0) {
        throw new ConflictException(
          'Appointment changed concurrently; refresh and try again',
        );
      }

      return await this.prisma.appointment.findUnique({
        where: { id },
        include: {
          customer: { include: { user: { select: {
            id: true, phone: true, firstName: true, lastName: true, role: true,
          } } } },
          barber: { include: { user: { select: {
            id: true, phone: true, firstName: true, lastName: true, role: true,
          } } } },
          service: true,
          salon: true,
        },
      });
    }

    const [barber, service] = await Promise.all([
      this.prisma.barber.findUnique({ where: { id: barberId } }),
      this.prisma.service.findUnique({ where: { id: serviceId } }),
    ]);

    if (!barber) {
      throw new NotFoundException('Barber not found');
    }
    if (!service) {
      throw new NotFoundException('Service not found');
    }
    if (!barber.isActive) {
      throw new ConflictException('Cannot book an inactive barber');
    }
    if (!service.isActive) {
      throw new ConflictException('Cannot book an inactive service');
    }

    // An edit may change the barber/service, but never move the appointment
    // to a different salon (even if both selected records belong together).
    if (
      barber.salonId !== appointment.salonId ||
      service.salonId !== appointment.salonId ||
      barber.salonId !== service.salonId
    ) {
      throw new BadRequestException(
        'Appointment, barber and service must belong to the same salon',
      );
    }

    const barberService = await this.prisma.barberService.findUnique({
      where: {
        barberId_serviceId: { barberId: barber.id, serviceId: service.id },
      },
    });

    if (!barberService) {
      throw new ConflictException(
        'This barber does not provide the selected service',
      );
    }

    const slotValidation = await this.availabilityService.validateBookingSlot({
      salonId: appointment.salonId,
      barberId: barber.id,
      serviceId: service.id,
      startAt,
    });
    const endAt = slotValidation.endAt;

    const overlappingAppointment = await this.prisma.appointment.findFirst({
      where: {
        id: { not: appointment.id },
        barberId: barber.id,
        status: {
          in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
        },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
    });

    if (overlappingAppointment) {
      throw new ConflictException('Barber is already booked during this time');
    }

    try {
      // updatedAt acts as a compare-and-set token: concurrent edits/status
      // changes cannot silently overwrite this update.
      const result = await this.prisma.appointment.updateMany({
        where: {
          id,
          updatedAt: appointment.updatedAt,
          status: appointment.status,
        },
        data: {
          barberId: barber.id,
          serviceId: service.id,
          startAt,
          endAt,
          duration: service.duration,
          price: service.price,
          ...(dto.note !== undefined ? { note: dto.note } : {}),
        },
      });

      if (result.count === 0) {
        throw new ConflictException(
          'Appointment changed concurrently; refresh and try again',
        );
      }

      return await this.prisma.appointment.findUnique({
        where: { id },
        include: {
          customer: { include: { user: { select: {
            id: true, phone: true, firstName: true, lastName: true, role: true,
          } } } },
          barber: { include: { user: { select: {
            id: true, phone: true, firstName: true, lastName: true, role: true,
          } } } },
          service: true,
          salon: true,
        },
      });
    } catch (error) {
      if (this.isAppointmentOverlapConstraintError(error)) {
        throw new ConflictException('Barber is already booked during this time');
      }
      throw error;
    }
  }

  /**
   * تغییر وضعیت نوبت با کنترل دسترسی سالن.
   */
  async updateStatus(
    id: string,
    dto: UpdateAppointmentStatusDto,
    userId: string,
    role: UserRole,
  ) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    await this.salonAccessService.assertCanAccessSalon(
      userId,
      role,
      appointment.salonId,
    );

    const allowedTransitions: Record<AppointmentStatus, AppointmentStatus[]> = {
      [AppointmentStatus.PENDING]: [
        AppointmentStatus.CONFIRMED,
        AppointmentStatus.CANCELLED,
      ],
      [AppointmentStatus.CONFIRMED]: [
        AppointmentStatus.COMPLETED,
        AppointmentStatus.CANCELLED,
        AppointmentStatus.NO_SHOW,
      ],
      [AppointmentStatus.COMPLETED]: [],
      [AppointmentStatus.CANCELLED]: [],
      [AppointmentStatus.NO_SHOW]: [],
    };

    const allowedStatuses = allowedTransitions[appointment.status];

    if (!allowedStatuses.includes(dto.status)) {
      throw new ConflictException(
        `Cannot change appointment status from ${appointment.status} to ${dto.status}`,
      );
    }

    // پیش از تأیید نوبت، دوباره تداخل زمانی بررسی می‌شود.
    if (dto.status === AppointmentStatus.CONFIRMED) {
      const overlappingAppointment = await this.prisma.appointment.findFirst({
        where: {
          id: {
            not: appointment.id,
          },
          barberId: appointment.barberId,
          status: {
            in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
          },
          startAt: {
            lt: appointment.endAt,
          },
          endAt: {
            gt: appointment.startAt,
          },
        },
      });

      if (overlappingAppointment) {
        throw new ConflictException(
          'Cannot confirm appointment because the barber is already booked during this time',
        );
      }
    }

    try {
      // Compare-and-set: do not overwrite a status changed by another request
      // after the initial read and transition validation.
      const result = await this.prisma.appointment.updateMany({
        where: {
          id,
          updatedAt: appointment.updatedAt,
          status: appointment.status,
        },
        data: {
          status: dto.status,
        },
      });

      if (result.count === 0) {
        throw new ConflictException(
          'Appointment status changed concurrently; refresh and try again',
        );
      }

      return await this.prisma.appointment.findUnique({
        where: { id },
        include: {
          customer: {
            include: {
              user: {
                select: {
                  id: true,
                  phone: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                },
              },
            },
          },
          barber: {
            include: {
              user: {
                select: {
                  id: true,
                  phone: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                },
              },
            },
          },
          service: true,
          salon: true,
        },
      });
    } catch (error) {
      if (this.isAppointmentOverlapConstraintError(error)) {
        throw new ConflictException(
          'Cannot confirm appointment because the barber is already booked during this time',
        );
      }

      throw error;
    }
  }

  /**
   * لغو نوبت با کنترل دسترسی سالن.
   */
  async remove(id: string, userId: string, role: UserRole) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    await this.salonAccessService.assertCanAccessSalon(
      userId,
      role,
      appointment.salonId,
    );

    if (appointment.status === AppointmentStatus.COMPLETED) {
      throw new ConflictException('Completed appointment cannot be cancelled');
    }

    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new ConflictException('Appointment is already cancelled');
    }

    if (appointment.status === AppointmentStatus.NO_SHOW) {
      throw new ConflictException('No-show appointment cannot be cancelled');
    }

    const result = await this.prisma.appointment.updateMany({
      where: {
        id,
        status: appointment.status,
      },
      data: {
        status: AppointmentStatus.CANCELLED,
      },
    });

    if (result.count === 0) {
      throw new ConflictException(
        'Appointment status changed concurrently; refresh and try again',
      );
    }

    return {
      message: 'Appointment cancelled successfully',
    };
  }
}
