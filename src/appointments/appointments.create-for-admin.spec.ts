import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppointmentStatus, UserRole } from '../generated/prisma/client.js';
import { AppointmentsService } from './appointments.service.js';

describe('AppointmentsService.createForAdmin', () => {
  const prisma = {
    customer: { findUnique: vi.fn() },
    barber: { findUnique: vi.fn() },
    service: { findUnique: vi.fn() },
    barberService: { findUnique: vi.fn() },
    appointment: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  };

  const availabilityService = {
    validateBookingSlot: vi.fn(),
  };

  const salonAccessService = {
    assertCanAccessSalon: vi.fn(),
  };

  let service: AppointmentsService;

  const dto = {
    customerId: 'customer-1',
    barberId: 'barber-1',
    serviceId: 'service-1',
    startAt: '2099-01-01T10:00:00.000Z',
    note: 'Admin booking',
  };

  beforeEach(() => {
    vi.resetAllMocks();

    service = new AppointmentsService(
      prisma as never,
      availabilityService as never,
      salonAccessService as never,
    );

    prisma.barber.findUnique.mockResolvedValue({
      id: 'barber-1',
      salonId: 'salon-1',
      isActive: true,
    });
    prisma.service.findUnique.mockResolvedValue({
      id: 'service-1',
      salonId: 'salon-1',
      isActive: true,
      duration: 30,
      price: '25.00',
    });
    prisma.customer.findUnique.mockResolvedValue({ id: 'customer-1' });
    prisma.barberService.findUnique.mockResolvedValue({
      barberId: 'barber-1',
      serviceId: 'service-1',
    });
    prisma.appointment.findFirst.mockResolvedValue(null);
    prisma.appointment.create.mockResolvedValue({ id: 'appointment-1' });
    availabilityService.validateBookingSlot.mockResolvedValue({
      endAt: new Date('2099-01-01T10:30:00.000Z'),
    });
    salonAccessService.assertCanAccessSalon.mockResolvedValue(undefined);
  });

  it('authorizes salon access before looking up the requested customer', async () => {
    const forbidden = new ForbiddenException('No access to salon');
    salonAccessService.assertCanAccessSalon.mockRejectedValueOnce(forbidden);

    await expect(
      service.createForAdmin('admin-1', UserRole.ADMIN, dto),
    ).rejects.toBe(forbidden);

    expect(salonAccessService.assertCanAccessSalon).toHaveBeenCalledWith(
      'admin-1',
      UserRole.ADMIN,
      'salon-1',
    );
    expect(prisma.customer.findUnique).not.toHaveBeenCalled();
    expect(prisma.appointment.create).not.toHaveBeenCalled();
  });

  it('creates an appointment for the selected customer after authorization', async () => {
    await expect(
      service.createForAdmin('admin-1', UserRole.ADMIN, dto),
    ).resolves.toEqual({ id: 'appointment-1' });

    expect(prisma.customer.findUnique).toHaveBeenCalledWith({
      where: { id: 'customer-1' },
    });
    expect(salonAccessService.assertCanAccessSalon).toHaveBeenCalledTimes(1);
    expect(prisma.appointment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerId: 'customer-1',
          salonId: 'salon-1',
          barberId: 'barber-1',
          serviceId: 'service-1',
          status: AppointmentStatus.PENDING,
        }),
      }),
    );
  });

  it('does not query customer IDs until salon access has been checked', async () => {
    prisma.customer.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.createForAdmin('admin-1', UserRole.ADMIN, dto),
    ).rejects.toThrow('Customer not found');

    expect(salonAccessService.assertCanAccessSalon).toHaveBeenCalledWith(
      'admin-1',
      UserRole.ADMIN,
      'salon-1',
    );
    expect(prisma.appointment.create).not.toHaveBeenCalled();
  });

  it('re-checks authorization if the barber changes salons during creation', async () => {
    prisma.barber.findUnique
      .mockResolvedValueOnce({
        id: 'barber-1',
        salonId: 'salon-1',
        isActive: true,
      })
      .mockResolvedValueOnce({
        id: 'barber-1',
        salonId: 'salon-2',
        isActive: true,
      });
    prisma.service.findUnique.mockResolvedValue({
      id: 'service-1',
      salonId: 'salon-2',
      isActive: true,
      duration: 30,
      price: '25.00',
    });

    await expect(
      service.createForAdmin('admin-1', UserRole.ADMIN, dto),
    ).resolves.toEqual({ id: 'appointment-1' });

    expect(salonAccessService.assertCanAccessSalon).toHaveBeenNthCalledWith(
      1,
      'admin-1',
      UserRole.ADMIN,
      'salon-1',
    );
    expect(salonAccessService.assertCanAccessSalon).toHaveBeenNthCalledWith(
      2,
      'admin-1',
      UserRole.ADMIN,
      'salon-2',
    );
    expect(prisma.appointment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ salonId: 'salon-2' }),
      }),
    );
  });

  it('maps PostgreSQL overlap constraint errors to ConflictException', async () => {
    prisma.appointment.create.mockRejectedValueOnce(
      new Error(
        'conflicting key value violates exclusion constraint "appointment_no_overlap"',
      ),
    );

    await expect(
      service.createForAdmin('admin-1', UserRole.ADMIN, dto),
    ).rejects.toMatchObject({
      status: 409,
      response: expect.objectContaining({
        message: 'Barber is already booked during this time',
      }),
    });
  });
});
