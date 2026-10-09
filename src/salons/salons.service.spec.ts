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

import {
  UserRole,
  UserStatus,
} from '../generated/prisma/client.js';

import { PrismaService } from '../prisma/prisma.service.js';
import { SalonAccessService } from './salon-access.service.js';
import { SalonsService } from './salons.service.js';

describe('SalonsService', () => {
  let service: SalonsService;

  const prisma = {
    salon: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    salonMembership: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };

  const salonAccessService = {
    assertCanAccessSalon: vi.fn(),
  };

  const mockSalon = {
    id: 'salon-1',
    name: 'Test Salon',
    slug: 'test-salon',
    isActive: true,
    timezone: 'Asia/Tehran',
  };

  const mockAdmin = {
    id: 'admin-1',
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
  };

  const mockMembership = {
    id: 'membership-1',
    userId: 'admin-1',
    salonId: 'salon-1',
    isActive: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    service = new SalonsService(
      prisma as unknown as PrismaService,
      salonAccessService as unknown as SalonAccessService,
    );
  });

  describe('create', () => {
    it('creates a salon with default timezone and active status', async () => {
      prisma.salon.findUnique.mockResolvedValue(null);
      prisma.salon.create.mockResolvedValue(mockSalon);

      await expect(
        service.create({
          name: 'Test Salon',
          slug: 'test-salon',
        }),
      ).resolves.toEqual(mockSalon);

      expect(prisma.salon.create).toHaveBeenCalledWith({
        data: {
          name: 'Test Salon',
          slug: 'test-salon',
          phone: undefined,
          address: undefined,
          description: undefined,
          timezone: 'Asia/Tehran',
          isActive: true,
        },
      });
    });

    it('rejects a duplicate slug', async () => {
      prisma.salon.findUnique.mockResolvedValue(mockSalon);

      await expect(
        service.create({
          name: 'Another Salon',
          slug: 'test-salon',
        }),
      ).rejects.toThrow(ConflictException);

      expect(prisma.salon.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('returns only active salons ordered by creation date', async () => {
      prisma.salon.findMany.mockResolvedValue([mockSalon]);

      await expect(service.findAll()).resolves.toEqual([
        mockSalon,
      ]);

      expect(prisma.salon.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    });
  });

  describe('findById', () => {
    it('returns an existing salon', async () => {
      prisma.salon.findUnique.mockResolvedValue(mockSalon);

      await expect(
        service.findById('salon-1'),
      ).resolves.toEqual(mockSalon);
    });

    it('throws when the salon does not exist', async () => {
      prisma.salon.findUnique.mockResolvedValue(null);

      await expect(
        service.findById('missing-salon'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates a salon after checking access', async () => {
      prisma.salon.findUnique.mockResolvedValue(mockSalon);
      prisma.salon.update.mockResolvedValue({
        ...mockSalon,
        name: 'Updated Salon',
      });

      await expect(
        service.update(
          'salon-1',
          { name: 'Updated Salon' },
          'admin-1',
          UserRole.ADMIN,
        ),
      ).resolves.toMatchObject({
        name: 'Updated Salon',
      });

      expect(
        salonAccessService.assertCanAccessSalon,
      ).toHaveBeenCalledWith(
        'admin-1',
        UserRole.ADMIN,
        'salon-1',
      );

      expect(prisma.salon.update).toHaveBeenCalledWith({
        where: {
          id: 'salon-1',
        },
        data: {
          name: 'Updated Salon',
        },
      });
    });

    it('rejects updating a nonexistent salon', async () => {
      prisma.salon.findUnique.mockResolvedValue(null);

      await expect(
        service.update(
          'missing-salon',
          { name: 'Updated Salon' },
          'admin-1',
          UserRole.ADMIN,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(
        salonAccessService.assertCanAccessSalon,
      ).not.toHaveBeenCalled();
    });

    it('rejects a slug already used by another salon', async () => {
      prisma.salon.findUnique.mockResolvedValue(mockSalon);
      prisma.salon.findFirst.mockResolvedValue({
        id: 'salon-2',
        slug: 'other-salon',
      });

      await expect(
        service.update(
          'salon-1',
          { slug: 'other-salon' },
          'admin-1',
          UserRole.ADMIN,
        ),
      ).rejects.toThrow(ConflictException);

      expect(prisma.salon.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deactivates a salon instead of deleting it', async () => {
      prisma.salon.findUnique.mockResolvedValue(mockSalon);
      prisma.salon.update.mockResolvedValue({
        ...mockSalon,
        isActive: false,
      });

      await expect(
        service.remove(
          'salon-1',
          'admin-1',
          UserRole.ADMIN,
        ),
      ).resolves.toMatchObject({
        isActive: false,
      });

      expect(
        salonAccessService.assertCanAccessSalon,
      ).toHaveBeenCalledWith(
        'admin-1',
        UserRole.ADMIN,
        'salon-1',
      );

      expect(prisma.salon.update).toHaveBeenCalledWith({
        where: {
          id: 'salon-1',
        },
        data: {
          isActive: false,
        },
      });
    });
  });

  describe('createMembership', () => {
    beforeEach(() => {
      prisma.salon.findUnique.mockResolvedValue(mockSalon);
      prisma.user.findUnique.mockResolvedValue(mockAdmin);
      prisma.salonMembership.findUnique.mockResolvedValue(null);
    });

    it('creates a membership for an active admin', async () => {
      prisma.salonMembership.create.mockResolvedValue(
        mockMembership,
      );

      await expect(
        service.createMembership('salon-1', {
          userId: 'admin-1',
        }),
      ).resolves.toEqual(mockMembership);

      expect(prisma.salonMembership.create).toHaveBeenCalledWith({
        data: {
          userId: 'admin-1',
          salonId: 'salon-1',
        },
      });
    });

    it('rejects a nonexistent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.createMembership('salon-1', {
          userId: 'missing-user',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a user who is not an admin', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockAdmin,
        role: UserRole.CUSTOMER,
      });

      await expect(
        service.createMembership('salon-1', {
          userId: 'admin-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an inactive admin', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockAdmin,
        status: UserStatus.INACTIVE,
      });

      await expect(
        service.createMembership('salon-1', {
          userId: 'admin-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a membership that is already active', async () => {
      prisma.salonMembership.findUnique.mockResolvedValue(
        mockMembership,
      );

      await expect(
        service.createMembership('salon-1', {
          userId: 'admin-1',
        }),
      ).rejects.toThrow(ConflictException);

      expect(prisma.salonMembership.create).not.toHaveBeenCalled();
    });

    it('reactivates an existing inactive membership', async () => {
      prisma.salonMembership.findUnique.mockResolvedValue({
        ...mockMembership,
        isActive: false,
      });

      prisma.salonMembership.update.mockResolvedValue(
        mockMembership,
      );

      await expect(
        service.createMembership('salon-1', {
          userId: 'admin-1',
        }),
      ).resolves.toEqual(mockMembership);

      expect(prisma.salonMembership.update).toHaveBeenCalledWith({
        where: {
          id: 'membership-1',
        },
        data: {
          isActive: true,
        },
      });

      expect(prisma.salonMembership.create).not.toHaveBeenCalled();
    });
  });

  describe('deactivateMembership', () => {
    it('deactivates an active membership', async () => {
      prisma.salon.findUnique.mockResolvedValue(mockSalon);
      prisma.salonMembership.findUnique.mockResolvedValue(
        mockMembership,
      );
      prisma.salonMembership.update.mockResolvedValue({
        ...mockMembership,
        isActive: false,
      });

      await expect(
        service.deactivateMembership('salon-1', 'admin-1'),
      ).resolves.toMatchObject({
        isActive: false,
      });

      expect(prisma.salonMembership.update).toHaveBeenCalledWith({
        where: {
          id: 'membership-1',
        },
        data: {
          isActive: false,
        },
      });
    });

    it('throws when membership does not exist', async () => {
      prisma.salon.findUnique.mockResolvedValue(mockSalon);
      prisma.salonMembership.findUnique.mockResolvedValue(null);

      await expect(
        service.deactivateMembership('salon-1', 'admin-1'),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.salonMembership.update).not.toHaveBeenCalled();
    });

    it('throws when membership is already inactive', async () => {
      prisma.salon.findUnique.mockResolvedValue(mockSalon);
      prisma.salonMembership.findUnique.mockResolvedValue({
        ...mockMembership,
        isActive: false,
      });

      await expect(
        service.deactivateMembership('salon-1', 'admin-1'),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.salonMembership.update).not.toHaveBeenCalled();
    });
  });
});
