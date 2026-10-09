import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRole } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SalonAccessService } from '../salons/salon-access.service.js';
import { DaysOffService } from './days-off.service.js';
import { WorkingHoursService } from './working-hours.service.js';

describe('Schedule services cross-salon authorization', () => {
  const prisma = {
    barber: { findUnique: vi.fn() },
    workingHour: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    dayOff: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  };
  const salonAccessService = { assertCanAccessSalon: vi.fn() };
  let workingHours: WorkingHoursService;
  let daysOff: DaysOffService;

  beforeEach(() => {
    vi.resetAllMocks();
    workingHours = new WorkingHoursService(
      prisma as unknown as PrismaService,
      salonAccessService as unknown as SalonAccessService,
    );
    daysOff = new DaysOffService(
      prisma as unknown as PrismaService,
      salonAccessService as unknown as SalonAccessService,
    );
    prisma.barber.findUnique.mockResolvedValue({
      id: 'barber-other',
      salonId: 'salon-other',
      isActive: true,
    });
    salonAccessService.assertCanAccessSalon.mockRejectedValue(
      new ForbiddenException('You do not have access to this salon'),
    );
  });

  it('rejects cross-salon working-hours reads before querying schedules', async () => {
    await expect(
      workingHours.findByBarber('barber-other', 'admin-one', UserRole.ADMIN),
    ).rejects.toThrow(ForbiddenException);
    expect(salonAccessService.assertCanAccessSalon).toHaveBeenCalledWith(
      'admin-one',
      UserRole.ADMIN,
      'salon-other',
    );
    expect(prisma.workingHour.findMany).not.toHaveBeenCalled();
  });

  it('rejects cross-salon working-hours writes before upserting', async () => {
    await expect(
      workingHours.upsert(
        'barber-other',
        'MONDAY' as never,
        { startTime: '09:00', endTime: '17:00' },
        'admin-one',
        UserRole.ADMIN,
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.workingHour.upsert).not.toHaveBeenCalled();
  });

  it('rejects cross-salon days-off reads before querying schedules', async () => {
    await expect(
      daysOff.findByBarber('barber-other', 'admin-one', UserRole.ADMIN),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.dayOff.findMany).not.toHaveBeenCalled();
  });

  it('rejects cross-salon days-off writes before creating records', async () => {
    await expect(
      daysOff.create(
        'barber-other',
        { date: '2026-11-12' },
        'admin-one',
        UserRole.ADMIN,
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.dayOff.create).not.toHaveBeenCalled();
  });
});
