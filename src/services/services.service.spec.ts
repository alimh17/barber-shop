import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserRole } from '../generated/prisma/client.js';
import { ServicesService } from './services.service.js';

describe('ServicesService salon access', () => {
  const prisma = {
    salon: {
      findUnique: vi.fn(),
    },
    service: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };

  const salonAccessService = {
    assertCanAccessSalon: vi.fn(),
  };

  let service: ServicesService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new ServicesService(prisma as never, salonAccessService as never);
    salonAccessService.assertCanAccessSalon.mockResolvedValue(undefined);
    prisma.salon.findUnique.mockResolvedValue({
      id: 'salon-1',
      isActive: true,
    });
    prisma.service.findUnique.mockResolvedValue({
      id: 'service-1',
      salonId: 'salon-1',
      salon: { id: 'salon-1' },
      barbers: [],
    });
    prisma.service.findMany.mockResolvedValue([]);
    prisma.service.update.mockResolvedValue({ id: 'service-1' });
  });

  it('checks salon access before creating a service', async () => {
    const dto = {
      salonId: 'salon-2',
      name: 'Cut',
      duration: 30,
      price: 20,
    };
    salonAccessService.assertCanAccessSalon.mockRejectedValue(
      new ForbiddenException(),
    );

    await expect(
      service.create(dto, 'admin-1', UserRole.ADMIN),
    ).rejects.toThrow(ForbiddenException);

    expect(salonAccessService.assertCanAccessSalon).toHaveBeenCalledWith(
      'admin-1',
      UserRole.ADMIN,
      'salon-2',
    );
    expect(prisma.salon.findUnique).not.toHaveBeenCalled();
    expect(prisma.service.create).not.toHaveBeenCalled();
  });

  it('requires ADMIN to provide a salonId when listing services', async () => {
    await expect(service.findAll('admin-1', UserRole.ADMIN)).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.service.findMany).not.toHaveBeenCalled();
  });

  it('checks access before listing services for a salon', async () => {
    salonAccessService.assertCanAccessSalon.mockRejectedValue(
      new ForbiddenException(),
    );

    await expect(
      service.findAll('admin-1', UserRole.ADMIN, 'salon-2'),
    ).rejects.toThrow(ForbiddenException);

    expect(prisma.service.findMany).not.toHaveBeenCalled();
  });

  it('checks the service salon before returning service details', async () => {
    salonAccessService.assertCanAccessSalon.mockRejectedValue(
      new ForbiddenException(),
    );

    await expect(
      service.findById('service-1', 'admin-1', UserRole.ADMIN),
    ).rejects.toThrow(ForbiddenException);

    expect(salonAccessService.assertCanAccessSalon).toHaveBeenCalledWith(
      'admin-1',
      UserRole.ADMIN,
      'salon-1',
    );
  });

  it('checks access before updating a service', async () => {
    salonAccessService.assertCanAccessSalon.mockRejectedValue(
      new ForbiddenException(),
    );

    await expect(
      service.update(
        'service-1',
        { name: 'Updated' },
        'admin-1',
        UserRole.ADMIN,
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(prisma.service.update).not.toHaveBeenCalled();
  });

  it('checks access before deactivating a service', async () => {
    salonAccessService.assertCanAccessSalon.mockRejectedValue(
      new ForbiddenException(),
    );

    await expect(
      service.remove('service-1', 'admin-1', UserRole.ADMIN),
    ).rejects.toThrow(ForbiddenException);

    expect(prisma.service.update).not.toHaveBeenCalled();
  });

  it('allows SUPER_ADMIN to list all services without a salon filter', async () => {
    await service.findAll('super-1', UserRole.SUPER_ADMIN);

    expect(salonAccessService.assertCanAccessSalon).not.toHaveBeenCalled();
    expect(prisma.service.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });
});
