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

    // برای رزرو مدیریتی، دسترسی به سالن باید تأیید شود.
    if (accessContext) {
      await this.salonAccessService.assertCanAccessSalon(
        accessContext.userId,
        accessContext.role,
        barber.salonId,
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
      return await this.prisma.appointment.update({
        where: { id },
        data: {
          status: dto.status,
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

    await this.prisma.appointment.update({
      where: { id },
      data: {
        status: AppointmentStatus.CANCELLED,
      },
    });

    return {
      message: 'Appointment cancelled successfully',
    };
  }
}
