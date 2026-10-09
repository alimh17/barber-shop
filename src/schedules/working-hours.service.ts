import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DayOfWeek, UserRole } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SalonAccessService } from '../salons/salon-access.service.js';
import { UpsertWorkingHourDto } from './dto/upsert-working-hour.dto.js';

@Injectable()
export class WorkingHoursService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly salonAccessService: SalonAccessService,
  ) {}

  private async getAuthorizedBarber(
    barberId: string,
    userId: string,
    role: UserRole,
  ) {
    const barber = await this.prisma.barber.findUnique({
      where: { id: barberId },
    });
    if (!barber) throw new NotFoundException('Barber not found');
    await this.salonAccessService.assertCanAccessSalon(
      userId,
      role,
      barber.salonId,
    );
    return barber;
  }

  async upsert(
    barberId: string,
    dayOfWeek: DayOfWeek,
    dto: UpsertWorkingHourDto,
    userId: string,
    role: UserRole,
  ) {
    const barber = await this.getAuthorizedBarber(barberId, userId, role);
    if (!barber.isActive)
      throw new ConflictException(
        'Cannot set working hours for inactive barber',
      );
    if (dto.startTime >= dto.endTime)
      throw new BadRequestException('startTime must be before endTime');

    return this.prisma.workingHour.upsert({
      where: { barberId_dayOfWeek: { barberId, dayOfWeek } },
      create: {
        barberId,
        salonId: barber.salonId,
        dayOfWeek,
        startTime: dto.startTime,
        endTime: dto.endTime,
        isActive: true,
      },
      update: {
        startTime: dto.startTime,
        endTime: dto.endTime,
        isActive: true,
      },
    });
  }

  async findByBarber(barberId: string, userId: string, role: UserRole) {
    await this.getAuthorizedBarber(barberId, userId, role);
    return this.prisma.workingHour.findMany({
      where: { barberId },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  async remove(
    barberId: string,
    dayOfWeek: DayOfWeek,
    userId: string,
    role: UserRole,
  ) {
    await this.getAuthorizedBarber(barberId, userId, role);
    const workingHour = await this.prisma.workingHour.findUnique({
      where: { barberId_dayOfWeek: { barberId, dayOfWeek } },
    });
    if (!workingHour) throw new NotFoundException('Working hour not found');

    await this.prisma.workingHour.delete({
      where: { barberId_dayOfWeek: { barberId, dayOfWeek } },
    });
    return { message: 'Working hour removed successfully' };
  }
}
