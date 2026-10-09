import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { UserRole } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SalonAccessService } from '../salons/salon-access.service.js';

@Injectable()
export class BarberServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly salonAccessService: SalonAccessService,
  ) {}

  async attach(
    barberId: string,
    serviceId: string,
    userId: string,
    role: UserRole,
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

    await this.salonAccessService.assertCanAccessSalon(
      userId,
      role,
      barber.salonId,
    );

    if (!barber.isActive) {
      throw new ConflictException('Cannot attach service to inactive barber');
    }

    const service = await this.prisma.service.findUnique({
      where: {
        id: serviceId,
      },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    if (barber.salonId !== service.salonId) {
      throw new ConflictException(
        'Barber and service must belong to the same salon',
      );
    }

    if (!service.isActive) {
      throw new ConflictException('Cannot attach inactive service');
    }

    const existing = await this.prisma.barberService.findUnique({
      where: {
        barberId_serviceId: {
          barberId,
          serviceId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Service is already assigned to this barber');
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
    userId: string,
    role: UserRole,
  ) {
    const existing = await this.prisma.barberService.findUnique({
      where: {
        barberId_serviceId: {
          barberId,
          serviceId,
        },
      },
      include: {
        barber: true,
        service: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Service is not assigned to this barber');
    }

    await this.salonAccessService.assertCanAccessSalon(
      userId,
      role,
      existing.barber.salonId,
    );

    if (existing.barber.salonId !== existing.service.salonId) {
      throw new ConflictException(
        'Barber and service must belong to the same salon',
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

  async findByBarber(barberId: string, userId: string, role: UserRole) {
    const barber = await this.prisma.barber.findUnique({
      where: {
        id: barberId,
      },
    });

    if (!barber) {
      throw new NotFoundException('Barber not found');
    }

    await this.salonAccessService.assertCanAccessSalon(
      userId,
      role,
      barber.salonId,
    );

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

  async findByService(serviceId: string, userId: string, role: UserRole) {
    const service = await this.prisma.service.findUnique({
      where: {
        id: serviceId,
      },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    await this.salonAccessService.assertCanAccessSalon(
      userId,
      role,
      service.salonId,
    );

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
