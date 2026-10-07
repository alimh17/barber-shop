import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  AppointmentStatus,
} from '../generated/prisma/client.js';

import { PrismaService } from '../prisma/prisma.service.js';

import { CreateAppointmentDto } from './dto/create-appointment.dto.js';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto.js';

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

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

    const endAt = new Date(
      startAt.getTime() +
      service.duration * 60 * 1000,
    );

    const overlappingAppointment =
      await this.prisma.appointment.findFirst({
        where: {
          barberId: dto.barberId,

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

    return this.prisma.appointment.create({
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

    if (
      appointment.status ===
      AppointmentStatus.CANCELLED
    ) {
      throw new ConflictException(
        'Cancelled appointment cannot be updated',
      );
    }

    if (
      appointment.status ===
      AppointmentStatus.COMPLETED &&
      dto.status !== AppointmentStatus.COMPLETED
    ) {
      throw new ConflictException(
        'Completed appointment cannot be reopened',
      );
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
        'Completed appointment cannot be deleted',
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