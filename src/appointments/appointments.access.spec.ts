import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserRole } from '../generated/prisma/client.js';
import { AppointmentsService } from './appointments.service.js';

describe('AppointmentsService access control', () => {
  const prisma = {
    salonMembership: {
      findMany: vi.fn(),
    },
    appointment: {
      findMany: vi.fn(),
    },
  };

  let service: AppointmentsService;

  beforeEach(() => {
    vi.resetAllMocks();

    service = new AppointmentsService(
      prisma as never,
      {} as never,
    );

    prisma.salonMembership.findMany.mockResolvedValue([
      { salonId: 'salon-1' },
    ]);

    prisma.appointment.findMany.mockResolvedValue([]);
  });

  it('limits an ADMIN to appointments in their active salons', async () => {
    await service.findAll('admin-1', UserRole.ADMIN);

    expect(prisma.salonMembership.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'admin-1',
        isActive: true,
      },
      select: {
        salonId: true,
      },
    });

    expect(prisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          salonId: {
            in: ['salon-1'],
          },
        },
      }),
    );
  });

  it('allows SUPER_ADMIN to list appointments across all salons', async () => {
    await service.findAll('super-admin-1', UserRole.SUPER_ADMIN);

    expect(prisma.salonMembership.findMany).not.toHaveBeenCalled();

    expect(prisma.appointment.findMany).toHaveBeenCalledWith(
      expect.not.objectContaining({
        where: expect.anything(),
      }),
    );
  });

  it('returns no appointments when an ADMIN has no active memberships', async () => {
    prisma.salonMembership.findMany.mockResolvedValue([]);

    await service.findAll('admin-2', UserRole.ADMIN);

    expect(prisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          salonId: {
            in: [],
          },
        },
      }),
    );
  });
});
