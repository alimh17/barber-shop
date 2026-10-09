import { ConflictException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserRole } from '../generated/prisma/client.js';
import { BarberServicesService } from './barber-services.service.js';

describe('BarberServicesService salon access', () => {
  const prisma = {
    barber: {
      findUnique: vi.fn(),
    },
    service: {
      findUnique: vi.fn(),
    },
    barberService: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  };

  const salonAccessService = {
    assertCanAccessSalon: vi.fn(),
  };

  let service: BarberServicesService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new BarberServicesService(
      prisma as never,
      salonAccessService as never,
    );
    salonAccessService.assertCanAccessSalon.mockResolvedValue(undefined);
    prisma.barber.findUnique.mockResolvedValue({
      id: 'barber-1',
      salonId: 'salon-1',
      isActive: true,
      salon: { id: 'salon-1' },
      user: { id: 'user-1' },
    });
    prisma.service.findUnique.mockResolvedValue({
      id: 'service-1',
      salonId: 'salon-1',
      isActive: true,
    });
    prisma.barberService.findUnique.mockResolvedValue(null);
    prisma.barberService.findMany.mockResolvedValue([]);
    prisma.barberService.create.mockResolvedValue({
      barberId: 'barber-1',
      serviceId: 'service-1',
    });
    prisma.barberService.delete.mockResolvedValue({});
  });

  it('checks barber salon access before looking up the service to attach', async () => {
    salonAccessService.assertCanAccessSalon.mockRejectedValue(
      new ForbiddenException(),
    );

    await expect(
      service.attach('barber-1', 'service-1', 'admin-1', UserRole.ADMIN),
    ).rejects.toThrow(ForbiddenException);

    expect(salonAccessService.assertCanAccessSalon).toHaveBeenCalledWith(
      'admin-1',
      UserRole.ADMIN,
      'salon-1',
    );
    expect(prisma.service.findUnique).not.toHaveBeenCalled();
    expect(prisma.barberService.create).not.toHaveBeenCalled();
  });

  it('rejects attaching a service from another salon', async () => {
    prisma.service.findUnique.mockResolvedValue({
      id: 'service-2',
      salonId: 'salon-2',
      isActive: true,
    });

    await expect(
      service.attach('barber-1', 'service-2', 'admin-1', UserRole.ADMIN),
    ).rejects.toThrow(ConflictException);

    expect(prisma.barberService.create).not.toHaveBeenCalled();
  });

  it('checks access before attaching a service', async () => {
    await service.attach('barber-1', 'service-1', 'admin-1', UserRole.ADMIN);

    expect(salonAccessService.assertCanAccessSalon).toHaveBeenCalledWith(
      'admin-1',
      UserRole.ADMIN,
      'salon-1',
    );
    expect(prisma.barberService.create).toHaveBeenCalled();
  });

  it('checks access to the barber salon before detaching a service', async () => {
    prisma.barberService.findUnique.mockResolvedValue({
      barberId: 'barber-1',
      serviceId: 'service-1',
      barber: { id: 'barber-1', salonId: 'salon-1' },
      service: { id: 'service-1', salonId: 'salon-1' },
    });
    salonAccessService.assertCanAccessSalon.mockRejectedValue(
      new ForbiddenException(),
    );

    await expect(
      service.detach('barber-1', 'service-1', 'admin-1', UserRole.ADMIN),
    ).rejects.toThrow(ForbiddenException);

    expect(prisma.barberService.delete).not.toHaveBeenCalled();
  });

  it('checks access before listing a barber services', async () => {
    salonAccessService.assertCanAccessSalon.mockRejectedValue(
      new ForbiddenException(),
    );

    await expect(
      service.findByBarber('barber-1', 'admin-1', UserRole.ADMIN),
    ).rejects.toThrow(ForbiddenException);

    expect(prisma.barberService.findMany).not.toHaveBeenCalled();
  });

  it('checks access before listing a service assigned barbers', async () => {
    salonAccessService.assertCanAccessSalon.mockRejectedValue(
      new ForbiddenException(),
    );

    await expect(
      service.findByService('service-1', 'admin-1', UserRole.ADMIN),
    ).rejects.toThrow(ForbiddenException);

    expect(prisma.barberService.findMany).not.toHaveBeenCalled();
  });

  it('allows SUPER_ADMIN to attach services without membership lookup', async () => {
    await service.attach(
      'barber-1',
      'service-1',
      'super-1',
      UserRole.SUPER_ADMIN,
    );

    expect(salonAccessService.assertCanAccessSalon).toHaveBeenCalledWith(
      'super-1',
      UserRole.SUPER_ADMIN,
      'salon-1',
    );
    expect(prisma.barberService.create).toHaveBeenCalled();
  });
});
