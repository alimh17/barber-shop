import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  AppointmentStatus,
  Prisma,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AvailabilityService } from '../availability/availability.service.js';
import { CreateAppointmentDto } from './dto/create-appointment.dto.js';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto.js';

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availabilityService: AvailabilityService,
  ) { }

  async create(
    userId: string,
    dto: CreateAppointmentDto,
  ) {
    const startAt = new Date(dto.startAt);

    if (Number.isNaN(startAt.getTime())) {
      throw new BadRequestException(
        'Invalid startAt',
      );
    }

    if (startAt <= new Date()) {
      throw new BadRequestException(
        'Appointment cannot be created in the past',
      );
    }

    const [customer, barber, service] =
      await Promise.all([
        this.prisma.customer.findUnique({
          where: {
            userId,
          },
        }),

        this.prisma.barber.findUnique({
          where: {
            id: dto.barberId,
          },
        }),

        this.prisma.service.findUnique({
          where: {
            id: dto.serviceId,
          },
        }),
      ]);

    if (!customer) {
      throw new NotFoundException(
        'Customer not found',
      );
    }

    if (!barber) {
      throw new NotFoundException(
        'Barber not found',
      );
    }

    if (!barber.isActive) {
      throw new ConflictException(
        'Cannot book an inactive barber',
      );
    }

    if (!service) {
      throw new NotFoundException(
        'Service not found',
      );
    }

    if (!service.isActive) {
      throw new ConflictException(
        'Cannot book an inactive service',
      );
    }

    if (barber.salonId !== service.salonId) {
      throw new BadRequestException(
        'Barber and service must belong to the same salon',
      );
    }

    const barberService =
      await this.prisma.barberService.findUnique({
        where: {
          barberId_serviceId: {
            barberId: dto.barberId,
            serviceId: dto.serviceId,
          },
        },
      });

    if (!barberService) {
      throw new ConflictException(
        'This barber does not provide the selected service',
      );
    }

    if (service.duration <= 0) {
      throw new ConflictException(
        'Service duration must be greater than zero',
      );
    }

    /*
     * Validate:
     *
     * - salon
     * - barber
     * - service
     * - barber service
     * - working hours
     * - day off
     * - appointment duration inside working hours
     *
     * The returned endAt is calculated from the
     * actual service duration.
     */
    const slotValidation =
      await this.availabilityService.validateBookingSlot({
        salonId: barber.salonId,
        barberId: barber.id,
        serviceId: service.id,
        startAt,
      });

    const endAt = slotValidation.endAt;

    /*
     * Check for an existing appointment.
     *
     * Overlap rule:
     *
     * newStart < existingEnd
     * &&
     * newEnd > existingStart
     *
     * CANCELLED / COMPLETED / NO_SHOW appointments
     * don't block a new booking.
     */
    const overlappingAppointment =
      await this.prisma.appointment.findFirst({
        where: {
          barberId: barber.id,

          status: {
            in: [
              AppointmentStatus.PENDING,
              AppointmentStatus.CONFIRMED,
            ],
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
      throw new ConflictException(
        'Barber is already booked during this time',
      );
    }
    try {
      return await this.prisma.appointment.create({
        data: {
          salonId: barber.salonId,

          customerId: customer.id,

          barberId: dto.barberId,
          serviceId: dto.serviceId,

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
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2004'
      ) {
        throw new ConflictException(
          'Barber is already booked during this time',
        );
      }

      throw error;
    }
  }

  async findById(id: string) {
    const appointment =
      await this.prisma.appointment.findUnique({
        where: {
          id,
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

    if (!appointment) {
      throw new NotFoundException(
        'Appointment not found',
      );
    }

    return appointment;
  }

  async findAll() {
    return this.prisma.appointment.findMany({
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

  async updateStatus(
    id: string,
    dto: UpdateAppointmentStatusDto,
  ) {
    const appointment =
      await this.prisma.appointment.findUnique({
        where: {
          id,
        },
      });

    if (!appointment) {
      throw new NotFoundException(
        'Appointment not found',
      );
    }

    /*
     * Allowed state transitions:
     *
     * PENDING
     *   -> CONFIRMED
     *   -> CANCELLED
     *
     * CONFIRMED
     *   -> COMPLETED
     *   -> CANCELLED
     *   -> NO_SHOW
     *
     * COMPLETED
     *   -> nothing
     *
     * CANCELLED
     *   -> nothing
     *
     * NO_SHOW
     *   -> nothing
     */
    const allowedTransitions: Record<
      AppointmentStatus,
      AppointmentStatus[]
    > = {
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

    const allowedStatuses =
      allowedTransitions[appointment.status];

    if (
      !allowedStatuses.includes(dto.status)
    ) {
      throw new ConflictException(
        `Cannot change appointment status from ${appointment.status} to ${dto.status}`,
      );
    }

    /*
     * If an appointment is being confirmed,
     * check again for an overlapping active appointment.
     *
     * This is important because another appointment
     * might have been created after this appointment
     * was initially created as PENDING.
     */
    if (
      dto.status ===
      AppointmentStatus.CONFIRMED
    ) {
      const overlappingAppointment =
        await this.prisma.appointment.findFirst({
          where: {
            id: {
              not: appointment.id,
            },

            barberId: appointment.barberId,

            status: {
              in: [
                AppointmentStatus.PENDING,
                AppointmentStatus.CONFIRMED,
              ],
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

    return this.prisma.appointment.update({
      where: {
        id,
      },

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
  }

  async remove(id: string) {
    const appointment =
      await this.prisma.appointment.findUnique({
        where: {
          id,
        },
      });

    if (!appointment) {
      throw new NotFoundException(
        'Appointment not found',
      );
    }

    if (
      appointment.status ===
      AppointmentStatus.COMPLETED
    ) {
      throw new ConflictException(
        'Completed appointment cannot be cancelled',
      );
    }

    if (
      appointment.status ===
      AppointmentStatus.CANCELLED
    ) {
      throw new ConflictException(
        'Appointment is already cancelled',
      );
    }

    if (
      appointment.status ===
      AppointmentStatus.NO_SHOW
    ) {
      throw new ConflictException(
        'No-show appointment cannot be cancelled',
      );
    }

    await this.prisma.appointment.update({
      where: {
        id,
      },

      data: {
        status: AppointmentStatus.CANCELLED,
      },
    });

    return {
      message: 'Appointment cancelled successfully',
    };
  }
}