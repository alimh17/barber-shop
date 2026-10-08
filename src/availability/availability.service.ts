import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  AppointmentStatus,
  DayOfWeek,
} from '../generated/prisma/client.js';

import { PrismaService } from '../prisma/prisma.service.js';

import { GetAvailabilityDto } from './dto/get-availability.dto.js';

type ExistingAppointment = {
  startAt: Date;
  endAt: Date;
};

type TimeParts = {
  hour: number;
  minute: number;
};

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async getAvailability(dto: GetAvailabilityDto) {
    const {
      salonId,
      barberId,
      serviceId,
      date,
    } = dto;

    const slotIntervalMinutes =
      dto.slotIntervalMinutes ?? 15;

    const salon = await this.prisma.salon.findUnique({
      where: {
        id: salonId,
      },
    });

    if (!salon) {
      throw new NotFoundException('Salon not found');
    }

    if (!salon.isActive) {
      throw new ConflictException(
        'Salon is inactive',
      );
    }

    const barber = await this.prisma.barber.findUnique({
      where: {
        id: barberId,
      },
    });

    if (!barber) {
      throw new NotFoundException(
        'Barber not found',
      );
    }

    if (!barber.isActive) {
      throw new ConflictException(
        'Barber is inactive',
      );
    }

    if (barber.salonId !== salonId) {
      throw new BadRequestException(
        'Barber does not belong to this salon',
      );
    }

    const service = await this.prisma.service.findUnique({
      where: {
        id: serviceId,
      },
    });

    if (!service) {
      throw new NotFoundException(
        'Service not found',
      );
    }

    if (!service.isActive) {
      throw new ConflictException(
        'Service is inactive',
      );
    }

    if (service.salonId !== salonId) {
      throw new BadRequestException(
        'Service does not belong to this salon',
      );
    }

    const barberService =
      await this.prisma.barberService.findUnique({
        where: {
          barberId_serviceId: {
            barberId,
            serviceId,
          },
        },
      });

    if (!barberService) {
      throw new ConflictException(
        'Barber does not provide this service',
      );
    }

    if (service.duration <= 0) {
      throw new ConflictException(
        'Service duration must be greater than zero',
      );
    }

    this.validateTimezone(salon.timezone);

    const dayOfWeek = this.getDayOfWeek(
      date,
      salon.timezone,
    );

    const workingHour =
      await this.prisma.workingHour.findUnique({
        where: {
          barberId_dayOfWeek: {
            barberId,
            dayOfWeek,
          },
        },
      });

    if (!workingHour || !workingHour.isActive) {
      return this.emptyAvailability({
        salonId,
        barberId,
        serviceId,
        date,
        timezone: salon.timezone,
        dayOfWeek,
        serviceDurationMinutes: service.duration,
        slotIntervalMinutes,
      });
    }

    const dayOff = await this.findDayOff(
      barberId,
      date,
      salon.timezone,
    );

    if (dayOff) {
      return this.emptyAvailability({
        salonId,
        barberId,
        serviceId,
        date,
        timezone: salon.timezone,
        dayOfWeek,
        serviceDurationMinutes: service.duration,
        slotIntervalMinutes,
        workingHours: {
          startTime: workingHour.startTime,
          endTime: workingHour.endTime,
        },
        dayOff: true,
      });
    }

    const workingStart = this.localDateTimeToUtc(
      date,
      workingHour.startTime,
      salon.timezone,
    );

    const workingEnd = this.localDateTimeToUtc(
      date,
      workingHour.endTime,
      salon.timezone,
    );

    if (workingStart >= workingEnd) {
      throw new BadRequestException(
        'Invalid working hours',
      );
    }

    const existingAppointments =
      await this.prisma.appointment.findMany({
        where: {
          barberId,
          startAt: {
            lt: workingEnd,
          },
          endAt: {
            gt: workingStart,
          },
          status: {
            in: [
              AppointmentStatus.PENDING,
              AppointmentStatus.CONFIRMED,
            ],
          },
        },
        select: {
          startAt: true,
          endAt: true,
        },
        orderBy: {
          startAt: 'asc',
        },
      });

    const slots = this.generateSlots({
      date,
      timezone: salon.timezone,
      workingStart,
      workingEnd,
      serviceDurationMinutes: service.duration,
      slotIntervalMinutes,
      existingAppointments,
    });

    return {
      salonId,
      barberId,
      serviceId,
      date,
      timezone: salon.timezone,
      dayOfWeek,
      serviceDurationMinutes: service.duration,
      slotIntervalMinutes,
      workingHours: {
        startTime: workingHour.startTime,
        endTime: workingHour.endTime,
      },
      dayOff: false,
      slots,
    };
  }

  private generateSlots(params: {
    date: string;
    timezone: string;
    workingStart: Date;
    workingEnd: Date;
    serviceDurationMinutes: number;
    slotIntervalMinutes: number;
    existingAppointments: ExistingAppointment[];
  }) {
    const {
      date,
      timezone,
      workingStart,
      workingEnd,
      serviceDurationMinutes,
      slotIntervalMinutes,
      existingAppointments,
    } = params;

    const serviceDurationMs =
      serviceDurationMinutes * 60 * 1000;

    const intervalMs =
      slotIntervalMinutes * 60 * 1000;

    const now = Date.now();

    const slots: Array<{
      startAt: string;
      endAt: string;
      localStart: string;
      localEnd: string;
    }> = [];

    for (
      let startMs = workingStart.getTime();
      startMs + serviceDurationMs <=
      workingEnd.getTime();
      startMs += intervalMs
    ) {
      const endMs =
        startMs + serviceDurationMs;

      if (startMs < now) {
        continue;
      }

      const hasConflict =
        existingAppointments.some(
          (appointment) =>
            startMs <
              appointment.endAt.getTime() &&
            endMs >
              appointment.startAt.getTime(),
        );

      if (hasConflict) {
        continue;
      }

      const startAt = new Date(startMs);
      const endAt = new Date(endMs);

      slots.push({
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        localStart: this.formatLocalDateTime(
          startAt,
          timezone,
        ),
        localEnd: this.formatLocalDateTime(
          endAt,
          timezone,
        ),
      });
    }

    return slots;
  }

  private async findDayOff(
    barberId: string,
    date: string,
    timezone: string,
  ) {
    const dayStart = this.localDateTimeToUtc(
      date,
      '00:00',
      timezone,
    );

    const nextDate = this.addDays(date, 1);

    const dayEnd = this.localDateTimeToUtc(
      nextDate,
      '00:00',
      timezone,
    );

    return this.prisma.dayOff.findFirst({
      where: {
        barberId,
        date: {
          gte: dayStart,
          lt: dayEnd,
        },
      },
    });
  }

  private emptyAvailability(params: {
    salonId: string;
    barberId: string;
    serviceId: string;
    date: string;
    timezone: string;
    dayOfWeek: DayOfWeek;
    serviceDurationMinutes: number;
    slotIntervalMinutes: number;
    workingHours?: {
      startTime: string;
      endTime: string;
    };
    dayOff?: boolean;
  }) {
    return {
      salonId: params.salonId,
      barberId: params.barberId,
      serviceId: params.serviceId,
      date: params.date,
      timezone: params.timezone,
      dayOfWeek: params.dayOfWeek,
      serviceDurationMinutes:
        params.serviceDurationMinutes,
      slotIntervalMinutes:
        params.slotIntervalMinutes,
      workingHours:
        params.workingHours ?? null,
      dayOff: params.dayOff ?? false,
      slots: [],
    };
  }

  private getDayOfWeek(
    date: string,
    timezone: string,
  ): DayOfWeek {
    const utcDate = this.localDateTimeToUtc(
      date,
      '12:00',
      timezone,
    );

    const formatter = new Intl.DateTimeFormat(
      'en-US',
      {
        timeZone: timezone,
        weekday: 'long',
      },
    );

    const weekday = formatter
      .format(utcDate)
      .toUpperCase();

    const mapping: Record<
      string,
      DayOfWeek
    > = {
      SATURDAY: DayOfWeek.SATURDAY,
      SUNDAY: DayOfWeek.SUNDAY,
      MONDAY: DayOfWeek.MONDAY,
      TUESDAY: DayOfWeek.TUESDAY,
      WEDNESDAY: DayOfWeek.WEDNESDAY,
      THURSDAY: DayOfWeek.THURSDAY,
      FRIDAY: DayOfWeek.FRIDAY,
    };

    const result = mapping[weekday];

    if (!result) {
      throw new BadRequestException(
        'Could not determine day of week',
      );
    }

    return result;
  }

  private localDateTimeToUtc(
    date: string,
    time: string,
    timezone: string,
  ): Date {
    const [year, month, day] =
      date.split('-').map(Number);

    const [hour, minute] =
      time.split(':').map(Number);

    if (
      !year ||
      !month ||
      !day ||
      Number.isNaN(hour) ||
      Number.isNaN(minute)
    ) {
      throw new BadRequestException(
        'Invalid date or time',
      );
    }

    const utcGuess = Date.UTC(
      year,
      month - 1,
      day,
      hour,
      minute,
    );

    const offset = this.getTimezoneOffset(
      new Date(utcGuess),
      timezone,
    );

    return new Date(
      utcGuess - offset,
    );
  }

  private getTimezoneOffset(
    date: Date,
    timezone: string,
  ): number {
    const parts = new Intl.DateTimeFormat(
      'en-US',
      {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      },
    ).formatToParts(date);

    const values: Record<string, string> = {};

    for (const part of parts) {
      values[part.type] = part.value;
    }

    const asUtc = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second),
    );

    return asUtc - date.getTime();
  }

  private formatLocalDateTime(
    date: Date,
    timezone: string,
  ): string {
    const parts = new Intl.DateTimeFormat(
      'en-CA',
      {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      },
    ).formatToParts(date);

    const values: Record<string, string> = {};

    for (const part of parts) {
      values[part.type] = part.value;
    }

    return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
  }

  private addDays(
    date: string,
    days: number,
  ): string {
    const [year, month, day] =
      date.split('-').map(Number);

    const result = new Date(
      Date.UTC(
        year,
        month - 1,
        day + days,
      ),
    );

    return result.toISOString().slice(0, 10);
  }

  private validateTimezone(
    timezone: string,
  ): void {
    try {
      new Intl.DateTimeFormat(
        'en-US',
        {
          timeZone: timezone,
        },
      );
    } catch {
      throw new BadRequestException(
        `Invalid salon timezone: ${timezone}`,
      );
    }
  }
}