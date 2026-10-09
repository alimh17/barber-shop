import { ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppointmentStatus, UserRole } from '../generated/prisma/client.js';
import { AppointmentsService } from './appointments.service.js';

describe('AppointmentsService appointment status concurrency', () => {
  const prisma = {
    appointment: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
  };
  const salonAccessService = {
    assertCanAccessSalon: vi.fn(),
  };
  let service: AppointmentsService;

  const appointment = {
    id: 'appointment-1',
    salonId: 'salon-1',
    barberId: 'barber-1',
    startAt: new Date('2099-01-01T10:00:00.000Z'),
    endAt: new Date('2099-01-01T10:30:00.000Z'),
    status: AppointmentStatus.PENDING,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    service = new AppointmentsService(
      prisma as never,
      {} as never,
      salonAccessService as never,
    );
    prisma.appointment.findUnique.mockResolvedValue(appointment);
    prisma.appointment.findFirst.mockResolvedValue(null);
    prisma.appointment.updateMany.mockResolvedValue({ count: 1 });
    salonAccessService.assertCanAccessSalon.mockResolvedValue(undefined);
  });

  it('updates status only if the status has not changed since it was read', async () => {
    prisma.appointment.findUnique
      .mockResolvedValueOnce(appointment)
      .mockResolvedValueOnce({
        ...appointment,
        status: AppointmentStatus.CONFIRMED,
      });

    await expect(
      service.updateStatus(
        'appointment-1',
        { status: AppointmentStatus.CONFIRMED },
        'admin-1',
        UserRole.ADMIN,
      ),
    ).resolves.toMatchObject({ status: AppointmentStatus.CONFIRMED });

    expect(prisma.appointment.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'appointment-1',
        status: AppointmentStatus.PENDING,
      },
      data: { status: AppointmentStatus.CONFIRMED },
    });
  });

  it('rejects a stale status update when another request wins the race', async () => {
    prisma.appointment.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.updateStatus(
        'appointment-1',
        { status: AppointmentStatus.CONFIRMED },
        'admin-1',
        UserRole.ADMIN,
      ),
    ).rejects.toThrow(
      new ConflictException(
        'Appointment status changed concurrently; refresh and try again',
      ),
    );

    expect(prisma.appointment.findUnique).toHaveBeenCalledTimes(1);
  });

  it('does not cancel an appointment whose status changed concurrently', async () => {
    prisma.appointment.findUnique.mockResolvedValue({
      ...appointment,
      status: AppointmentStatus.CONFIRMED,
    });
    prisma.appointment.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.remove('appointment-1', 'admin-1', UserRole.ADMIN),
    ).rejects.toThrow(
      new ConflictException(
        'Appointment status changed concurrently; refresh and try again',
      ),
    );

    expect(prisma.appointment.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'appointment-1',
        status: AppointmentStatus.CONFIRMED,
      },
      data: { status: AppointmentStatus.CANCELLED },
    });
  });

  it('rejects status changes when the user cannot access the salon', async () => {
    const forbidden = new Error('Forbidden');
    salonAccessService.assertCanAccessSalon.mockRejectedValueOnce(forbidden);

    await expect(
      service.updateStatus(
        'appointment-1',
        { status: AppointmentStatus.CONFIRMED },
        'admin-2',
        UserRole.ADMIN,
      ),
    ).rejects.toBe(forbidden);

    expect(prisma.appointment.findFirst).not.toHaveBeenCalled();
    expect(prisma.appointment.updateMany).not.toHaveBeenCalled();
  });

  it('rejects invalid status transitions before attempting an update', async () => {
    prisma.appointment.findUnique.mockResolvedValue({
      ...appointment,
      status: AppointmentStatus.COMPLETED,
    });

    await expect(
      service.updateStatus(
        'appointment-1',
        { status: AppointmentStatus.CONFIRMED },
        'admin-1',
        UserRole.ADMIN,
      ),
    ).rejects.toThrow('Cannot change appointment status');

    expect(prisma.appointment.updateMany).not.toHaveBeenCalled();
  });
});
