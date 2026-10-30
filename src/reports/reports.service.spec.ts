import { ForbiddenException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppointmentStatus, UserRole } from '../generated/prisma/client.js';
import { ReportsService } from './reports.service.js';

const money = (value: string) => ({ toString: () => value });

describe('ReportsService', () => {
  const prisma = {
    salon: { findUnique: vi.fn() },
    appointment: { findMany: vi.fn() },
    barber: { findMany: vi.fn() },
  };
  const salonAccessService = { assertCanAccessSalon: vi.fn() };
  let service: ReportsService;

  const records = [
    {
      id: 'appointment-1',
      startAt: new Date('2026-10-05T08:00:00.000Z'),
      price: money('150000'),
      barberId: 'barber-1',
      service: { name: 'اصلاح مو' },
      barber: {
        user: { phone: '09121111111', firstName: 'علی', lastName: 'رضایی' },
      },
      customer: {
        user: { phone: '09122222222', firstName: 'مینا', lastName: 'احمدی' },
      },
    },
    {
      id: 'appointment-2',
      startAt: new Date('2026-10-06T10:00:00.000Z'),
      price: money('250000'),
      barberId: 'barber-1',
      service: { name: 'اصلاح کامل' },
      barber: {
        user: { phone: '09121111111', firstName: 'علی', lastName: 'رضایی' },
      },
      customer: {
        user: { phone: '09123333333', firstName: null, lastName: null },
      },
    },
  ];

  beforeEach(() => {
    vi.resetAllMocks();
    service = new ReportsService(prisma as never, salonAccessService as never);
    prisma.salon.findUnique.mockResolvedValue({
      id: 'salon-1',
      name: 'سالن تست',
      slug: 'test-salon',
      timezone: 'Asia/Tehran',
      isActive: true,
    });
    prisma.appointment.findMany.mockResolvedValue(records);
    prisma.barber.findMany.mockResolvedValue([
      {
        id: 'barber-1',
        isActive: true,
        user: { phone: '09121111111', firstName: 'علی', lastName: 'رضایی' },
      },
      {
        id: 'barber-2',
        isActive: false,
        user: { phone: '09124444444', firstName: 'رضا', lastName: 'کریمی' },
      },
    ]);
    salonAccessService.assertCanAccessSalon.mockResolvedValue(undefined);
  });

  it('reports only the requested salon completed appointments and reconciles barber totals', async () => {
    const report = await service.getRevenueReport(
      {
        salonId: 'salon-1',
        from: '2026-10-01',
        to: '2026-11-01',
        page: 1,
        limit: 25,
      },
      'admin-1',
      UserRole.ADMIN,
    );

    expect(salonAccessService.assertCanAccessSalon).toHaveBeenCalledWith(
      'admin-1',
      UserRole.ADMIN,
      'salon-1',
    );
    expect(prisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          salonId: 'salon-1',
          status: AppointmentStatus.COMPLETED,
          startAt: {
            gte: new Date('2026-09-30T20:30:00.000Z'),
            lt: new Date('2026-10-31T20:30:00.000Z'),
          },
        },
      }),
    );
    expect(report.totalRevenue).toBe(400000);
    expect(report.appointmentCount).toBe(2);
    expect(report.averageAppointmentRevenue).toBe(200000);
    expect(report.byBarber).toEqual([
      expect.objectContaining({
        barberId: 'barber-1',
        revenue: 400000,
        appointmentCount: 2,
      }),
      expect.objectContaining({
        barberId: 'barber-2',
        revenue: 0,
        appointmentCount: 0,
      }),
    ]);
    expect(report.byMonth).toEqual([
      { month: '2026-10', revenue: 400000, appointmentCount: 2 },
    ]);
    expect(report.details.items[0]).toEqual(
      expect.objectContaining({ id: 'appointment-1', price: 150000 }),
    );
  });

  it('stops before reading revenue when the admin cannot access the salon', async () => {
    salonAccessService.assertCanAccessSalon.mockRejectedValue(
      new ForbiddenException(),
    );

    await expect(
      service.getRevenueReport(
        {
          salonId: 'salon-1',
          from: '2026-10-01',
          to: '2026-11-01',
          page: 1,
          limit: 25,
        },
        'admin-2',
        UserRole.ADMIN,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.appointment.findMany).not.toHaveBeenCalled();
  });

  it('exports a valid workbook with summary and detailed revenue sheets', async () => {
    const exported = await service.exportRevenueReport(
      { salonId: 'salon-1', from: '2026-10-01', to: '2026-11-01' },
      'admin-1',
      UserRole.ADMIN,
    );
    expect(exported.filename).toBe(
      'revenue-test-salon-2026-10-01-2026-11-01.xlsx',
    );
    expect(exported.buffer.subarray(0, 2).toString()).toBe('PK');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(exported.buffer);
    expect(workbook.getWorksheet('خلاصه')?.getCell('B5').value).toBe(400000);
    expect(workbook.getWorksheet('ریز درآمد')?.rowCount).toBe(4);
    expect(workbook.getWorksheet('ریز درآمد')?.getCell('H2').value).toBe(
      150000,
    );
  });
});
