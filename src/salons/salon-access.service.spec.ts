import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserRole } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

import { SalonAccessService } from './salon-access.service.js';

describe('SalonAccessService', () => {
  let service: SalonAccessService;

  const prisma = {
    salonMembership: {
      findFirst: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    service = new SalonAccessService(
      prisma as unknown as PrismaService,
    );
  });

  describe('assertCanAccessSalon', () => {
    it('allows SUPER_ADMIN without checking membership', async () => {
      await expect(
        service.assertCanAccessSalon(
          'super-admin-id',
          UserRole.SUPER_ADMIN,
          'salon-id',
        ),
      ).resolves.toBeUndefined();

      expect(
        prisma.salonMembership.findFirst,
      ).not.toHaveBeenCalled();
    });

    it('allows an admin with active salon membership', async () => {
      prisma.salonMembership.findFirst.mockResolvedValue({
        id: 'membership-id',
      });

      await expect(
        service.assertCanAccessSalon(
          'admin-id',
          UserRole.ADMIN,
          'salon-id',
        ),
      ).resolves.toBeUndefined();

      expect(
        prisma.salonMembership.findFirst,
      ).toHaveBeenCalledWith({
        where: {
          userId: 'admin-id',
          salonId: 'salon-id',
          isActive: true,
        },
        select: {
          id: true,
        },
      });
    });

    it('rejects an admin without salon membership', async () => {
      prisma.salonMembership.findFirst.mockResolvedValue(null);

      await expect(
        service.assertCanAccessSalon(
          'admin-id',
          UserRole.ADMIN,
          'salon-id',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects access to another salon without active membership', async () => {
      prisma.salonMembership.findFirst.mockResolvedValue(null);

      await expect(
        service.assertCanAccessSalon(
          'admin-id',
          UserRole.ADMIN,
          'another-salon-id',
        ),
      ).rejects.toThrow(
        'You do not have access to this salon',
      );

      expect(
        prisma.salonMembership.findFirst,
      ).toHaveBeenCalledWith({
        where: {
          userId: 'admin-id',
          salonId: 'another-salon-id',
          isActive: true,
        },
        select: {
          id: true,
        },
      });
    });
  });
});
