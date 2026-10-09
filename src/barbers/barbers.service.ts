
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  UserRole,
  UserStatus,
} from '../generated/prisma/client.js';

import { PrismaService } from '../prisma/prisma.service.js';
import { SalonAccessService } from '../salons/salon-access.service.js';

import { CreateBarberDto } from './dto/create-barber.dto.js';
import { UpdateBarberDto } from './dto/update-barber.dto.js';

@Injectable()
export class BarbersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly salonAccessService: SalonAccessService,
  ) { }

  async create(
    dto: CreateBarberDto,
    userId: string,
    role: UserRole,
  ) {
    await this.salonAccessService.assertCanAccessSalon(
      userId,
      role,
      dto.salonId,
    );

    const salon = await this.prisma.salon.findUnique({
      where: {
        id: dto.salonId,
      },
    });

    if (!salon) {
      throw new NotFoundException('Salon not found');
    }

    if (!salon.isActive) {
      throw new ConflictException(
        'Cannot create barber for inactive salon',
      );
    }

    const existingUser = await this.prisma.user.findUnique({
      where: {
        phone: dto.phone,
      },
    });

    if (existingUser) {
      throw new ConflictException(
        'A user with this phone already exists',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          phone: dto.phone,
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: UserRole.BARBER,
          status: UserStatus.ACTIVE,
        },
      });

      return tx.barber.create({
        data: {
          userId: user.id,
          salonId: dto.salonId,
        },
        include: {
          user: {
            select: {
              id: true,
              phone: true,
              firstName: true,
              lastName: true,
              role: true,
              status: true,
            },
          },
          salon: true,
        },
      });
    });
  }

  async findAll(
    userId: string,
    role: UserRole,
    salonId?: string,
  ) {
    if (role !== UserRole.SUPER_ADMIN && !salonId) {
      throw new BadRequestException(
        'salonId is required',
      );
    }

    if (salonId) {
      await this.salonAccessService.assertCanAccessSalon(
        userId,
        role,
        salonId,
      );
    }

    return this.prisma.barber.findMany({
      where: salonId ? { salonId } : {},
      include: {
        user: {
          select: {
            id: true,
            phone: true,
            firstName: true,
            lastName: true,
            role: true,
            status: true,
          },
        },
        salon: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findById(
    id: string,
    userId: string,
    role: UserRole,
  ) {
    const barber = await this.prisma.barber.findUnique({
      where: {
        id,
      },
      include: {
        user: {
          select: {
            id: true,
            phone: true,
            firstName: true,
            lastName: true,
            role: true,
            status: true,
          },
        },
        salon: true,
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

    return barber;
  }

  async update(
    id: string,
    dto: UpdateBarberDto,
    userId: string,
    role: UserRole,
  ) {
    const barber = await this.findById(
      id,
      userId,
      role,
    );

    if (dto.phone && dto.phone !== barber.user.phone) {
      const existingUser = await this.prisma.user.findUnique({
        where: {
          phone: dto.phone,
        },
      });

      if (existingUser) {
        throw new ConflictException(
          'A user with this phone already exists',
        );
      }
    }

    const {
      phone,
      firstName,
      lastName,
      isActive,
    } = dto;

    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: {
          id: barber.userId,
        },
        data: {
          ...(phone !== undefined ? { phone } : {}),
          ...(firstName !== undefined ? { firstName } : {}),
          ...(lastName !== undefined ? { lastName } : {}),
        },
      });

      return tx.barber.update({
        where: {
          id,
        },
        data: { isActive },
        include: {
          user: {
            select: {
              id: true,
              phone: true,
              firstName: true,
              lastName: true,
              role: true,
              status: true,
            },
          },
          salon: true,
        },
      });
    });
  }

  async remove(
    id: string,
    userId: string,
    role: UserRole,
  ) {
    await this.findById(id, userId, role);

    return this.prisma.barber.update({
      where: {
        id,
      },
      data: {
        isActive: false,
      },
    });
  }
}