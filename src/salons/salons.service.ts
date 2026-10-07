import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

import { CreateSalonDto } from './dto/create-salon.dto.js';
import { UpdateSalonDto } from './dto/update-salon.dto.js';

@Injectable()
export class SalonsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async create(dto: CreateSalonDto) {
    const existingSalon =
      await this.prisma.salon.findUnique({
        where: {
          slug: dto.slug,
        },
      });

    if (existingSalon) {
      throw new ConflictException(
        'Salon slug already exists',
      );
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
    const salon =
      await this.prisma.salon.findUnique({
        where: {
          id,
        },
      });

    if (!salon) {
      throw new NotFoundException(
        'Salon not found',
      );
    }

    return salon;
  }

  async update(
    id: string,
    dto: UpdateSalonDto,
  ) {
    await this.findById(id);

    if (dto.slug) {
      const existingSalon =
        await this.prisma.salon.findFirst({
          where: {
            slug: dto.slug,
            NOT: {
              id,
            },
          },
        });

      if (existingSalon) {
        throw new ConflictException(
          'Salon slug already exists',
        );
      }
    }

    return this.prisma.salon.update({
      where: {
        id,
      },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findById(id);

    return this.prisma.salon.update({
      where: {
        id,
      },
      data: {
        isActive: false,
      },
    });
  }
}