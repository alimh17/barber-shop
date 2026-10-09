import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { UserRole } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SalonAccessService } from '../salons/salon-access.service.js';

import { CreateServiceDto } from './dto/create-service.dto.js';
import { UpdateServiceDto } from './dto/update-service.dto.js';

@Injectable()
export class ServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly salonAccessService: SalonAccessService,
  ) {}

  async create(dto: CreateServiceDto, userId: string, role: UserRole) {
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
      throw new ConflictException('Cannot create service for inactive salon');
    }

    return this.prisma.service.create({
      data: {
        salonId: dto.salonId,
        name: dto.name,
        description: dto.description,
        duration: dto.duration,
        price: dto.price,
      },
      include: {
        salon: true,
      },
    });
  }

  async findAll(userId: string, role: UserRole, salonId?: string) {
    if (role !== UserRole.SUPER_ADMIN && !salonId) {
      throw new BadRequestException('salonId is required');
    }

    if (salonId) {
      await this.salonAccessService.assertCanAccessSalon(userId, role, salonId);
    }

    return this.prisma.service.findMany({
      where: salonId ? { salonId } : {},
      include: {
        salon: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findById(id: string, userId: string, role: UserRole) {
    const service = await this.prisma.service.findUnique({
      where: {
        id,
      },
      include: {
        salon: true,
        barbers: {
          include: {
            barber: {
              include: {
                user: true,
              },
            },
          },
        },
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

    return service;
  }

  async update(
    id: string,
    dto: UpdateServiceDto,
    userId: string,
    role: UserRole,
  ) {
    await this.findById(id, userId, role);

    return this.prisma.service.update({
      where: {
        id,
      },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.duration !== undefined ? { duration: dto.duration } : {}),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: {
        salon: true,
      },
    });
  }

  async remove(id: string, userId: string, role: UserRole) {
    await this.findById(id, userId, role);

    return this.prisma.service.update({
      where: {
        id,
      },
      data: {
        isActive: false,
      },
    });
  }
}
