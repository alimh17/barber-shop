
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

import { SalonAccessService } from './salon-access.service.js';
import { CreateSalonDto } from './dto/create-salon.dto.js';
import { UpdateSalonDto } from './dto/update-salon.dto.js';
import { CreateSalonMembershipDto } from './dto/create-salon-membership.dto.js';

@Injectable()
export class SalonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly salonAccessService: SalonAccessService,
  ) {}

  async create(dto: CreateSalonDto) {
    const existingSalon = await this.prisma.salon.findUnique({
      where: {
        slug: dto.slug,
      },
    });

    if (existingSalon) {
      throw new ConflictException('Salon slug already exists');
    }

    return this.prisma.salon.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        phone: dto.phone,
        address: dto.address,
        description: dto.description,
        timezone: dto.timezone ?? 'Asia/Tehran',
        isActive: dto.isActive ?? true,
      },
    });
  }

  async findAll() {
    return this.prisma.salon.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findById(id: string) {
    const salon = await this.prisma.salon.findUnique({
      where: {
        id,
      },
    });

    if (!salon) {
      throw new NotFoundException('Salon not found');
    }

    return salon;
  }

  async update(
    id: string,
    dto: UpdateSalonDto,
    userId: string,
    role: UserRole,
  ) {
    await this.findById(id);

    await this.salonAccessService.assertCanAccessSalon(
      userId,
      role,
      id,
    );

    if (dto.slug) {
      const existingSalon = await this.prisma.salon.findFirst({
        where: {
          slug: dto.slug,
          NOT: {
            id,
          },
        },
      });

      if (existingSalon) {
        throw new ConflictException('Salon slug already exists');
      }
    }

    return this.prisma.salon.update({
      where: {
        id,
      },
      data: dto,
    });
  }

  async remove(
    id: string,
    userId: string,
    role: UserRole,
  ) {
    await this.findById(id);

    await this.salonAccessService.assertCanAccessSalon(
      userId,
      role,
      id,
    );

    return this.prisma.salon.update({
      where: {
        id,
      },
      data: {
        isActive: false,
      },
    });
  }

  async createMembership(
    salonId: string,
    dto: CreateSalonMembershipDto,
  ) {
    await this.findById(salonId);

    const user = await this.prisma.user.findUnique({
      where: {
        id: dto.userId,
      },
      select: {
        id: true,
        role: true,
        status: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role !== UserRole.ADMIN) {
      throw new BadRequestException(
        'Only users with ADMIN role can be assigned to a salon',
      );
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new BadRequestException(
        'Inactive or blocked users cannot be assigned to a salon',
      );
    }

    const existingMembership =
      await this.prisma.salonMembership.findUnique({
        where: {
          userId_salonId: {
            userId: dto.userId,
            salonId,
          },
        },
      });

    if (existingMembership?.isActive) {
      throw new ConflictException(
        'This admin is already assigned to the salon',
      );
    }

    if (existingMembership) {
      return this.prisma.salonMembership.update({
        where: {
          id: existingMembership.id,
        },
        data: {
          isActive: true,
        },
      });
    }

    return this.prisma.salonMembership.create({
      data: {
        userId: dto.userId,
        salonId,
      },
    });
  }

  async deactivateMembership(
    salonId: string,
    userId: string,
  ) {
    await this.findById(salonId);

    const membership =
      await this.prisma.salonMembership.findUnique({
        where: {
          userId_salonId: {
            userId,
            salonId,
          },
        },
      });

    if (!membership || !membership.isActive) {
      throw new NotFoundException(
        'Active salon membership not found',
      );
    }

    return this.prisma.salonMembership.update({
      where: {
        id: membership.id,
      },
      data: {
        isActive: false,
      },
    });
  }
}