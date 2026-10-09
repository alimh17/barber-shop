
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { PrismaService } from '../prisma/prisma.service.js';
import { AvailabilityService } from './availability.service.js';

describe('AvailabilityService', () => {
  const prisma = {
    salon: {
      findUnique: vi.fn(),
    },
    barber: {
      findUnique: vi.fn(),
    },
    service: {
      findUnique: vi.fn(),
    },
    barberService: {
      findUnique: vi.fn(),
    },
    workingHour: {
      findUnique: vi.fn(),
    },
    dayOff: {
      findFirst: vi.fn(),
    },
    appointment: {
      findMany: vi.fn(),
    },
  };

  let service: AvailabilityService;

  const dto = {
    salonId: 'salon-1',
    barberId: 'barber-1',
    serviceId: 'service-1',
    date: '2030-01-01',
    slotIntervalMinutes: 60,
  };

  const mockSalon = {
    id: 'salon-1',
    isActive: true,
    timezone: 'Asia/Tehran',
  };

  const mockBarber = {
    id: 'barber-1',
    salonId: 'salon-1',
    isActive: true,
  };

  const mockService = {
    id: 'service-1',
    salonId: 'salon-1',
    isActive: true,
    duration: 30,
  };

  const mockWorkingHour = {
    barberId: 'barber-1',
    isActive: true,
    startTime: '09:00',
    endTime: '12:00',
  };

  beforeEach(() => {
    vi.resetAllMocks();

    service = new AvailabilityService(
      prisma as unknown as PrismaService,
    );

    prisma.salon.findUnique.mockResolvedValue(mockSalon);
    prisma.barber.findUnique.mockResolvedValue(mockBarber);
    prisma.service.findUnique.mockResolvedValue(mockService);
    prisma.barberService.findUnique.mockResolvedValue({
      barberId: 'barber-1',
      serviceId: 'service-1',
    });
    prisma.workingHour.findUnique.mockResolvedValue(
      mockWorkingHour,
    );
    prisma.dayOff.findFirst.mockResolvedValue(null);
    prisma.appointment.findMany.mockResolvedValue([]);
  });

  it.each([
    ['wrong format', '2030-1-01'],
    ['impossible calendar date', '2030-02-31'],
    ['invalid leap day', '2031-02-29'],
  ])('rejects an invalid availability date (%s)', async (_label, date) => {
    await expect(
      service.getAvailability({ ...dto, date }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.salon.findUnique).not.toHaveBeenCalled();
  });

  it('throws when the salon does not exist', async () => {
    prisma.salon.findUnique.mockResolvedValue(null);

    await expect(
      service.getAvailability(dto),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.barber.findUnique).not.toHaveBeenCalled();
  });

  it('rejects availability for an inactive salon', async () => {
    prisma.salon.findUnique.mockResolvedValue({
      ...mockSalon,
      isActive: false,
    });

    await expect(
      service.getAvailability(dto),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects a barber who belongs to another salon', async () => {
    prisma.barber.findUnique.mockResolvedValue({
      ...mockBarber,
      salonId: 'another-salon',
    });

    await expect(
      service.getAvailability(dto),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.service.findUnique).not.toHaveBeenCalled();
  });

  it('rejects an inactive service', async () => {
    prisma.service.findUnique.mockResolvedValue({
      ...mockService,
      isActive: false,
    });

    await expect(
      service.getAvailability(dto),
    ).rejects.toThrow(ConflictException);

    expect(prisma.barberService.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a service the barber does not provide', async () => {
    prisma.barberService.findUnique.mockResolvedValue(null);

    await expect(
      service.getAvailability(dto),
    ).rejects.toThrow(ConflictException);

    expect(prisma.workingHour.findUnique).not.toHaveBeenCalled();
  });

  it('returns no slots when the barber has no active working hours', async () => {
    prisma.workingHour.findUnique.mockResolvedValue(null);

    const result = await service.getAvailability(dto);

    expect(result.slots).toEqual([]);
    expect(result.workingHours).toBeNull();
    expect(result.dayOff).toBe(false);

    expect(prisma.dayOff.findFirst).not.toHaveBeenCalled();
    expect(prisma.appointment.findMany).not.toHaveBeenCalled();
  });

  it('returns no slots on a day off', async () => {
    prisma.dayOff.findFirst.mockResolvedValue({
      id: 'day-off-1',
      barberId: 'barber-1',
    });

    const result = await service.getAvailability(dto);

    expect(result.slots).toEqual([]);
    expect(result.dayOff).toBe(true);
    expect(result.workingHours).toEqual({
      startTime: '09:00',
      endTime: '12:00',
    });

    expect(prisma.appointment.findMany).not.toHaveBeenCalled();
  });

  it('generates future slots within working hours', async () => {
    const result = await service.getAvailability(dto);

    expect(result.dayOff).toBe(false);
    expect(result.timezone).toBe('Asia/Tehran');
    expect(result.serviceDurationMinutes).toBe(30);

    expect(result.slots).toHaveLength(3);

    expect(result.slots[0].localStart).toBe(
      '2030-01-01T09:00',
    );
    expect(result.slots[0].localEnd).toBe(
      '2030-01-01T09:30',
    );

    expect(result.slots[2].localStart).toBe(
      '2030-01-01T11:00',
    );
    expect(result.slots[2].localEnd).toBe(
      '2030-01-01T11:30',
    );
  });

  it('excludes slots that overlap existing active appointments', async () => {
    const existingStart = new Date(
      '2030-01-01T06:30:00.000Z',
    );

    const existingEnd = new Date(
      '2030-01-01T07:00:00.000Z',
    );

    prisma.appointment.findMany.mockResolvedValue([
      {
        startAt: existingStart,
        endAt: existingEnd,
      },
    ]);

    const result = await service.getAvailability(dto);

    expect(result.slots).toHaveLength(2);

    expect(
      result.slots.some(
        (slot) => slot.localStart === '2030-01-01T10:00',
      ),
    ).toBe(false);
  });
});