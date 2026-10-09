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
      findUnique: vi.fn(),
    },
  };

  const availabilityService = {};

  const salonAccessService = {
    assertCanAccessSalon: vi.fn(),
  };

  let service: AppointmentsService;

  beforeEach(() => {
    vi.resetAllMocks();

    service = new AppointmentsService(
      prisma as never,
      availabilityService as never,
      salonAccessService as never,
    );

    prisma.salonMembership.findMany.mockResolvedValue([
      { salonId: 'salon-1' },
    ]);

    prisma.appointment.findMany.mockResolvedValue([]);

    salonAccessService.assertCanAccessSalon.mockResolvedValue(undefined);

    prisma.appointment.findUnique.mockResolvedValue({
      id: 'appointment-1',
      salonId: 'salon-1',
    });
  });

  describe('findAll', () => {
    it('limits ADMIN to appointments in active salons', async () => {
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
        expect.objectContaining({
          where: {},
        }),
      );
    });

    it('returns no appointments when ADMIN has no active memberships', async () => {
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

  describe('findById', () => {
    it('checks salon access before returning an appointment to ADMIN', async () => {
      await service.findById(
        'appointment-1',
        'admin-1',
        UserRole.ADMIN,
      );

      expect(prisma.appointment.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'appointment-1',
          },
        }),
      );

      expect(salonAccessService.assertCanAccessSalon).toHaveBeenCalledWith(
        'admin-1',
        UserRole.ADMIN,
        'salon-1',
      );
    });

    it('checks salon access for SUPER_ADMIN as well', async () => {
      await service.findById(
        'appointment-1',
        'super-admin-1',
        UserRole.SUPER_ADMIN,
      );

      expect(salonAccessService.assertCanAccessSalon).toHaveBeenCalledWith(
        'super-admin-1',
        UserRole.SUPER_ADMIN,
        'salon-1',
      );
    });
  });
});
