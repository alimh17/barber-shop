import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { CreateDayOffDto } from './dto/create-day-off.dto.js';

@Injectable()
export class DaysOffService {
  constructor(private readonly prisma: PrismaService) {}

  private parseDate(date: string): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

    if (!match) {
      throw new ConflictException(
        'date must be in YYYY-MM-DD format',
      );
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    const parsed = new Date(
      Date.UTC(year, month - 1, day),
    );

    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      throw new ConflictException('Invalid date');
    }

    return parsed;
  }

  async create(
    barberId: string,
    dto: CreateDayOffDto,
  ) {
    const barber = await this.prisma.barber.findUnique({
      where: { id: barberId },
    });

    if (!barber) {
      throw new NotFoundException('Barber not found');
    }

    if (!barber.isActive) {
      throw new ConflictException(
        'Cannot set day off for inactive barber',
      );
    }

    const date = this.parseDate(dto.date);

    const existingDayOff =
      await this.prisma.dayOff.findUnique({
        where: {
          barberId_date: {
            barberId,
            date,
          },
        },
      });

    if (existingDayOff) {
      throw new ConflictException(
        'Day off already exists for this date',
      );
    }

    return this.prisma.dayOff.create({
      data: {
        barberId,
        salonId: barber.salonId,
        date,
        reason: dto.reason,
      },
    });
  }

  async findByBarber(barberId: string) {
    const barber = await this.prisma.barber.findUnique({
      where: { id: barberId },
    });

    if (!barber) {
      throw new NotFoundException('Barber not found');
    }

    return this.prisma.dayOff.findMany({
      where: {
        barberId,
      },
      orderBy: {
        date: 'asc',
      },
    });
  }

  async remove(
    barberId: string,
    dateString: string,
  ) {
    const date = this.parseDate(dateString);

    const dayOff = await this.prisma.dayOff.findUnique({
      where: {
        barberId_date: {
          barberId,
          date,
        },
      },
    });

    if (!dayOff) {
      throw new NotFoundException('Day off not found');
    }

    await this.prisma.dayOff.delete({
      where: {
        barberId_date: {
          barberId,
          date,
        },
      },
    });

    return {
      message: 'Day off removed successfully',
    };
  }
}