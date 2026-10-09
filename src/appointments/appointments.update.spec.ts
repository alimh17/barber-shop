import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppointmentStatus, UserRole } from '../generated/prisma/client.js';
import { AppointmentsService } from './appointments.service.js';

describe('AppointmentsService.update', () => {
  const prisma = {
    appointment: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    barber: { findUnique: vi.fn() },
    service: { findUnique: vi.fn() },
    barberService: { findUnique: vi.fn() },
  };
  const availabilityService = { validateBookingSlot: vi.fn() };
  const salonAccessService = { assertCanAccessSalon: vi.fn() };
  let service: AppointmentsService;

  const appointment = {
    id: 'appointment-1',
    salonId: 'salon-1',
    barberId: 'barber-1',
    serviceId: 'service-1',
    customerId: 'customer-1',
    startAt: new Date('2099-01-01T10:00:00.000Z'),
    endAt: new Date('2099-01-01T10:30:00.000Z'),
    status: AppointmentStatus.PENDING,
    updatedAt: new Date('2098-12-01T00:00:00.000Z'),
    note: 'old note',
  };

  beforeEach(() => {
    vi.resetAllMocks();
    service = new AppointmentsService(
      prisma as never,
      availabilityService as never,
      salonAccessService as never,
    );
    prisma.appointment.findUnique
      .mockResolvedValueOnce(appointment)
      .mockResolvedValue({ ...appointment, startAt: new Date('2099-01-01T11:00:00.000Z') });
    prisma.appointment.findFirst.mockResolvedValue(null);
    prisma.appointment.updateMany.mockResolvedValue({ count: 1 });
    prisma.barber.findUnique.mockResolvedValue({
      id: 'barber-1', salonId: 'salon-1', isActive: true,
    });
    prisma.service.findUnique.mockResolvedValue({
      id: 'service-1', salonId: 'salon-1', isActive: true,
      duration: 30, price: '25.00',
    });
    prisma.barberService.findUnique.mockResolvedValue({
      barberId: 'barber-1', serviceId: 'service-1',
    });
    availabilityService.validateBookingSlot.mockResolvedValue({
      endAt: new Date('2099-01-01T11:30:00.000Z'),
    });
    salonAccessService.assertCanAccessSalon.mockResolvedValue(undefined);
  });

  it('updates appointment details and refreshes duration and price from the service', async () => {
    await expect(service.update(
      'appointment-1',
      { startAt: '2099-01-01T11:00:00.000Z', note: 'updated' },
      'admin-1',
      UserRole.ADMIN,
    )).resolves.toMatchObject({ id: 'appointment-1' });

    expect(availabilityService.validateBookingSlot).toHaveBeenCalledWith({
      salonId: 'salon-1',
      barberId: 'barber-1',
      serviceId: 'service-1',
      startAt: new Date('2099-01-01T11:00:00.000Z'),
    });
    expect(prisma.appointment.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'appointment-1',
        updatedAt: appointment.updatedAt,
        status: AppointmentStatus.PENDING,
      },
      data: expect.objectContaining({
        startAt: new Date('2099-01-01T11:00:00.000Z'),
        endAt: new Date('2099-01-01T11:30:00.000Z'),
        duration: 30,
        price: '25.00',
        note: 'updated',
      }),
    });
  });

  it('checks salon authorization before reading barber or service records', async () => {
    const forbidden = new ForbiddenException('No access');
    salonAccessService.assertCanAccessSalon.mockRejectedValueOnce(forbidden);

    await expect(service.update(
      'appointment-1', { startAt: '2099-01-01T11:00:00.000Z' }, 'admin-2', UserRole.ADMIN,
    )).rejects.toBe(forbidden);

    expect(prisma.barber.findUnique).not.toHaveBeenCalled();
    expect(prisma.appointment.updateMany).not.toHaveBeenCalled();
  });

  it('rejects changing the appointment to a barber/service in another salon', async () => {
    prisma.barber.findUnique.mockResolvedValueOnce({
      id: 'barber-2', salonId: 'salon-2', isActive: true,
    });

    await expect(service.update(
      'appointment-1', { barberId: 'barber-2' }, 'admin-1', UserRole.ADMIN,
    )).rejects.toThrow(BadRequestException);

    expect(prisma.appointment.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a barber who is not assigned to the selected service', async () => {
    prisma.barberService.findUnique.mockResolvedValueOnce(null);

    await expect(service.update(
      'appointment-1', { serviceId: 'service-2' }, 'admin-1', UserRole.ADMIN,
    )).rejects.toThrow('This barber does not provide the selected service');

    expect(prisma.appointment.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a time slot that overlaps another active appointment', async () => {
    prisma.appointment.findFirst.mockResolvedValueOnce({ id: 'appointment-2' });

    await expect(service.update(
      'appointment-1', { startAt: '2099-01-01T11:00:00.000Z' }, 'admin-1', UserRole.ADMIN,
    )).rejects.toThrow('Barber is already booked during this time');

    expect(prisma.appointment.updateMany).not.toHaveBeenCalled();
  });

  it('allows a note-only edit when the appointment start time is in the past', async () => {
    const pastAppointment = {
      ...appointment,
      startAt: new Date('2000-01-01T10:00:00.000Z'),
      endAt: new Date('2000-01-01T10:30:00.000Z'),
    };
    prisma.appointment.findUnique
      .mockReset()
      .mockResolvedValueOnce(pastAppointment)
      .mockResolvedValue({ ...pastAppointment, note: 'updated note' });

    await expect(service.update(
      'appointment-1', { note: 'updated note' }, 'admin-1', UserRole.ADMIN,
    )).resolves.toMatchObject({ note: 'updated note' });

    expect(prisma.appointment.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ note: 'updated note' }),
    }));
  });

  it('rejects a stale edit if another request updates the appointment first', async () => {
    prisma.appointment.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(service.update(
      'appointment-1', { note: 'stale edit' }, 'admin-1', UserRole.ADMIN,
    )).rejects.toThrow('Appointment changed concurrently; refresh and try again');
  });

  it('maps the database overlap constraint to a conflict response', async () => {
    prisma.appointment.updateMany.mockRejectedValueOnce(
      new Error('conflicting key value violates exclusion constraint "appointment_no_overlap"'),
    );

    await expect(service.update(
      'appointment-1', { startAt: '2099-01-01T11:00:00.000Z' }, 'admin-1', UserRole.ADMIN,
    )).rejects.toMatchObject({ status: 409 });
  });

  it('does not allow editing a completed appointment', async () => {
    prisma.appointment.findUnique.mockReset().mockResolvedValue({
      ...appointment, status: AppointmentStatus.COMPLETED,
    });

    await expect(service.update(
      'appointment-1', { note: 'late change' }, 'admin-1', UserRole.ADMIN,
    )).rejects.toThrow(ConflictException);

    expect(prisma.appointment.updateMany).not.toHaveBeenCalled();
  });
});
