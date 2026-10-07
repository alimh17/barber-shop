import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class BarberServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async attach(
    barberId: string,
    serviceId: string,
  ) {
    const barber = await this.prisma.barber.findUnique({
      where: {
        id: barberId,
      },
      include: {
        salon: true,
        user: true,
      },
    });

    if (!barber) {
      throw new NotFoundException('Barber not found');
    }

    if (!barber.isActive) {
      throw new ConflictException(
        'Cannot attach service to inactive barber',
      );
    }

    const service = await this.prisma.service.findUnique({
      where: {
        id: serviceId,
      },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    if (!service.isActive) {
      throw new ConflictException(
        'Cannot attach inactive service',
      );
    }

    if (barber.salonId !== service.salonId) {
      throw new ConflictException(
        'Barber and service must belong to the same salon',
      );
    }

    const existing =
      await this.prisma.barberService.findUnique({
        where: {
          barberId_serviceId: {
            barberId,
            serviceId,
          },
        },
      });

    if (existing) {
      throw new ConflictException(
        'Service is already assigned to this barber',
      );
    }

    return this.prisma.barberService.create({
      data: {
        barberId,
        serviceId,
      },
      include: {
        barber: {
          include: {
            user: true,
          },
        },
        service: true,
      },
    });
  }

  async detach(
    barberId: string,
    serviceId: string,
  ) {
    const existing =
      await this.prisma.barberService.findUnique({
        where: {
          barberId_serviceId: {
            barberId,
            serviceId,
          },
        },
      });

    if (!existing) {
      throw new NotFoundException(
        'Service is not assigned to this barber',
      );
    }

    await this.prisma.barberService.delete({
      where: {
        barberId_serviceId: {
          barberId,
          serviceId,
        },
      },
    });

    return {
      message: 'Service detached from barber successfully',
    };
  }

  async findByBarber(barberId: string) {
    const barber = await this.prisma.barber.findUnique({
      where: {
        id: barberId,
      },
    });

    if (!barber) {
      throw new NotFoundException('Barber not found');
    }

    return this.prisma.barberService.findMany({
      where: {
        barberId,
      },
      include: {
        service: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findByService(serviceId: string) {
    const service = await this.prisma.service.findUnique({
      where: {
        id: serviceId,
      },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    return this.prisma.barberService.findMany({
      where: {
        serviceId,
      },
      include: {
        barber: {
          include: {
            user: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}