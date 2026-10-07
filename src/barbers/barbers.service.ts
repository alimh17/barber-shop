import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { CreateBarberDto } from './dto/create-barber.dto.js';
import { UpdateBarberDto } from './dto/update-barber.dto.js';

@Injectable()
export class BarbersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBarberDto) {
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
          role: 'BARBER',
          status: 'ACTIVE',
        },
      });

      const barber = await tx.barber.create({
        data: {
          userId: user.id,
          salonId: dto.salonId,
        },
        include: {
          user: true,
          salon: true,
        },
      });

      return barber;
    });
  }

  async findAll(salonId?: string) {
    return this.prisma.barber.findMany({
      where: {
        ...(salonId ? { salonId } : {}),
      },
      include: {
        user: true,
        salon: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findById(id: string) {
    const barber = await this.prisma.barber.findUnique({
      where: {
        id,
      },
      include: {
        user: true,
        salon: true,
      },
    });

    if (!barber) {
      throw new NotFoundException('Barber not found');
    }

    return barber;
  }

  async update(id: string, dto: UpdateBarberDto) {
    const barber = await this.findById(id);

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
      const user = await tx.user.update({
        where: {
          id: barber.userId,
        },
        data: {
          ...(phone !== undefined ? { phone } : {}),
          ...(firstName !== undefined
            ? { firstName }
            : {}),
          ...(lastName !== undefined
            ? { lastName }
            : {}),
        },
      });

      const updatedBarber = await tx.barber.update({
        where: {
          id,
        },
        data: {
          ...(isActive !== undefined ? { isActive } : {}),
        },
        include: {
          user: true,
          salon: true,
        },
      });

      return updatedBarber;
    });
  }

  async remove(id: string) {
    await this.findById(id);

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