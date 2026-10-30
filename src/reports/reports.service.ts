import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import ExcelJS from 'exceljs';

import { AppointmentStatus, UserRole } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SalonAccessService } from '../salons/salon-access.service.js';
import {
  RevenuePeriodQueryDto,
  RevenueReportQueryDto,
} from './dto/revenue-report-query.dto.js';

const DAY_MS = 24 * 60 * 60 * 1_000;
const TOMAN_FORMAT = '#,##0 "تومان"';

type RevenueRecord = {
  id: string;
  startAt: Date;
  price: { toString(): string };
  barberId: string;
  service: { name: string };
  barber: {
    user: {
      phone: string;
      firstName: string | null;
      lastName: string | null;
    };
  };
  customer: {
    user: {
      phone: string;
      firstName: string | null;
      lastName: string | null;
    };
  };
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly salonAccessService: SalonAccessService,
  ) {}

  async getMyRevenue(userId: string, period = 'week') {
    if (!['day', 'week', 'month'].includes(period)) {
      throw new BadRequestException('Invalid revenue period');
    }
    const barber = await this.prisma.barber.findUnique({
      where: { userId },
      select: { id: true, salon: { select: { timezone: true } } },
    });
    if (!barber) throw new NotFoundException('Barber not found');
    const timezone = barber.salon.timezone;
    const now = new Date();
    const localDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(now);
    const today = new Date(`${localDate}T00:00:00Z`);
    const count = period === 'day' ? 24 : period === 'week' ? 7 : 30;
    const startDay = new Date(today.getTime() - (period === 'day' ? 0 : count - 1) * DAY_MS);
    const startKey = startDay.toISOString().slice(0, 10);
    const from = this.localMidnightToUtc(startKey, timezone);
    const rows = await this.prisma.appointment.findMany({
      where: { barberId: barber.id, status: AppointmentStatus.COMPLETED, startAt: { gte: from, lte: now } },
      select: { startAt: true, price: true },
    });
    const buckets = Array.from({ length: count }, (_, index) => {
      if (period === 'day') return { key: String(index).padStart(2, '0'), revenue: 0, appointments: 0 };
      const date = new Date(startDay.getTime() + index * DAY_MS);
      return { key: date.toISOString().slice(0, 10), revenue: 0, appointments: 0 };
    });
    const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
    });
    for (const row of rows) {
      const parts = Object.fromEntries(formatter.formatToParts(row.startAt).map((part) => [part.type, part.value]));
      const key = period === 'day' ? parts.hour : `${parts.year}-${parts.month}-${parts.day}`;
      const bucket = byKey.get(key);
      if (bucket) { bucket.revenue += Number(row.price); bucket.appointments += 1; }
    }
    return {
      period, timezone, buckets,
      totalRevenue: buckets.reduce((sum, item) => sum + item.revenue, 0),
      appointmentCount: buckets.reduce((sum, item) => sum + item.appointments, 0),
    };
  }

  async getRevenueReport(
    query: RevenueReportQueryDto,
    userId: string,
    role: UserRole,
  ) {
    const context = await this.getContext(query, userId, role);
    const [records, barbers] = await Promise.all([
      this.prisma.appointment.findMany({
        where: context.where,
        orderBy: [{ startAt: 'desc' }, { id: 'desc' }],
        select: this.revenueSelect(),
      }),
      this.prisma.barber.findMany({
        where: { salonId: context.salon.id },
        orderBy: [{ user: { firstName: 'asc' } }, { createdAt: 'asc' }],
        select: {
          id: true,
          isActive: true,
          user: {
            select: {
              phone: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
    ]);

    const summary = this.buildSummary(
      records,
      barbers,
      query.from,
      query.to,
      context.salon.timezone,
    );
    const start = (query.page - 1) * query.limit;
    const details = records
      .slice(start, start + query.limit)
      .map((record) => this.toDetail(record, context.salon.timezone));

    return {
      salon: context.salon,
      period: {
        from: query.from,
        to: query.to,
        timezone: context.salon.timezone,
      },
      ...summary,
      details: {
        items: details,
        meta: {
          page: query.page,
          limit: query.limit,
          total: records.length,
          totalPages: Math.max(1, Math.ceil(records.length / query.limit)),
        },
      },
    };
  }

  async exportRevenueReport(
    query: RevenuePeriodQueryDto,
    userId: string,
    role: UserRole,
  ) {
    const context = await this.getContext(query, userId, role);
    const [records, barbers] = await Promise.all([
      this.prisma.appointment.findMany({
        where: context.where,
        orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
        select: this.revenueSelect(),
      }),
      this.prisma.barber.findMany({
        where: { salonId: context.salon.id },
        orderBy: [{ user: { firstName: 'asc' } }, { createdAt: 'asc' }],
        select: {
          id: true,
          isActive: true,
          user: {
            select: {
              phone: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
    ]);
    const summary = this.buildSummary(
      records,
      barbers,
      query.from,
      query.to,
      context.salon.timezone,
    );
    const workbook = this.buildWorkbook(
      context.salon,
      query,
      summary,
      records.map((record) => this.toDetail(record, context.salon.timezone)),
    );
    const data = await workbook.xlsx.writeBuffer();

    return {
      buffer: Buffer.from(data),
      filename: `revenue-${context.salon.slug}-${query.from}-${query.to}.xlsx`,
    };
  }

  private async getContext(
    query: RevenuePeriodQueryDto,
    userId: string,
    role: UserRole,
  ) {
    const salon = await this.prisma.salon.findUnique({
      where: { id: query.salonId },
      select: {
        id: true,
        name: true,
        slug: true,
        timezone: true,
        isActive: true,
      },
    });
    if (!salon) throw new NotFoundException('Salon not found');

    await this.salonAccessService.assertCanAccessSalon(userId, role, salon.id);
    const from = this.localMidnightToUtc(query.from, salon.timezone);
    const to = this.localMidnightToUtc(query.to, salon.timezone);
    const calendarDays =
      this.calendarDayNumber(query.to) - this.calendarDayNumber(query.from);
    if (calendarDays <= 0) {
      throw new BadRequestException('Report end date must be after start date');
    }
    if (calendarDays > 370) {
      throw new BadRequestException(
        'Revenue report range cannot exceed 370 days',
      );
    }

    return {
      salon,
      where: {
        salonId: salon.id,
        status: AppointmentStatus.COMPLETED,
        startAt: { gte: from, lt: to },
      },
    };
  }

  private revenueSelect() {
    return {
      id: true,
      startAt: true,
      price: true,
      barberId: true,
      service: { select: { name: true } },
      barber: {
        select: {
          user: {
            select: {
              phone: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      customer: {
        select: {
          user: {
            select: {
              phone: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    } as const;
  }

  private buildSummary(
    records: RevenueRecord[],
    barbers: Array<{
      id: string;
      isActive: boolean;
      user: {
        phone: string;
        firstName: string | null;
        lastName: string | null;
      };
    }>,
    from: string,
    to: string,
    timezone: string,
  ) {
    const totalsByBarber = new Map<
      string,
      { revenue: number; count: number }
    >();
    const totalsByMonth = new Map<string, { revenue: number; count: number }>();
    let totalRevenue = 0;

    for (const record of records) {
      const price = Number(record.price.toString());
      totalRevenue += price;
      const barber = totalsByBarber.get(record.barberId) ?? {
        revenue: 0,
        count: 0,
      };
      barber.revenue += price;
      barber.count += 1;
      totalsByBarber.set(record.barberId, barber);

      const month = this.localMonthKey(record.startAt, timezone);
      const monthTotal = totalsByMonth.get(month) ?? { revenue: 0, count: 0 };
      monthTotal.revenue += price;
      monthTotal.count += 1;
      totalsByMonth.set(month, monthTotal);
    }

    const byBarber = barbers
      .map((barber) => {
        const total = totalsByBarber.get(barber.id) ?? { revenue: 0, count: 0 };
        return {
          barberId: barber.id,
          barberName: this.personName(barber.user),
          phone: barber.user.phone,
          isActive: barber.isActive,
          revenue: total.revenue,
          appointmentCount: total.count,
        };
      })
      .sort(
        (a, b) =>
          b.revenue - a.revenue ||
          a.barberName.localeCompare(b.barberName, 'fa'),
      );

    const byMonth = this.monthKeys(from, to).map((month) => ({
      month,
      revenue: totalsByMonth.get(month)?.revenue ?? 0,
      appointmentCount: totalsByMonth.get(month)?.count ?? 0,
    }));

    return {
      totalRevenue,
      appointmentCount: records.length,
      averageAppointmentRevenue: records.length
        ? totalRevenue / records.length
        : 0,
      byBarber,
      byMonth,
    };
  }

  private buildWorkbook(
    salon: { name: string; timezone: string },
    period: RevenuePeriodQueryDto,
    summary: ReturnType<ReportsService['buildSummary']>,
    details: Array<ReturnType<ReportsService['toDetail']>>,
  ) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Barbershop';
    workbook.created = new Date();
    workbook.calcProperties.fullCalcOnLoad = true;

    const summarySheet = workbook.addWorksheet('خلاصه', {
      views: [{ rightToLeft: true, state: 'frozen', ySplit: 7 }],
    });
    summarySheet.addRow(['گزارش درآمد سالن']);
    summarySheet.mergeCells('A1:E1');
    summarySheet.addRow(['سالن', salon.name]);
    summarySheet.addRow(['بازه', `${period.from} تا ${period.to}`]);
    summarySheet.addRow(['منطقه زمانی', salon.timezone]);
    summarySheet.addRow(['درآمد کل', summary.totalRevenue]);
    summarySheet.addRow(['نوبت تکمیل‌شده', summary.appointmentCount]);
    summarySheet.addRow(['میانگین هر نوبت', summary.averageAppointmentRevenue]);
    summarySheet.addRow([]);
    summarySheet.addRow([
      'آرایشگر',
      'شماره تماس',
      'وضعیت',
      'نوبت تکمیل‌شده',
      'درآمد ایجادشده',
    ]);
    for (const barber of summary.byBarber) {
      summarySheet.addRow([
        barber.barberName,
        barber.phone,
        barber.isActive ? 'فعال' : 'غیرفعال',
        barber.appointmentCount,
        barber.revenue,
      ]);
    }
    summarySheet.addRow([]);
    summarySheet.addRow(['ماه', 'نوبت تکمیل‌شده', 'درآمد']);
    for (const month of summary.byMonth) {
      summarySheet.addRow([month.month, month.appointmentCount, month.revenue]);
    }

    const detailSheet = workbook.addWorksheet('ریز درآمد', {
      views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
    });
    detailSheet.columns = [
      { header: 'شناسه نوبت', key: 'id', width: 38 },
      { header: 'تاریخ', key: 'date', width: 14 },
      { header: 'ساعت', key: 'time', width: 10 },
      { header: 'آرایشگر', key: 'barberName', width: 24 },
      { header: 'مشتری', key: 'customerName', width: 24 },
      { header: 'شماره مشتری', key: 'customerPhone', width: 16 },
      { header: 'خدمت', key: 'serviceName', width: 24 },
      { header: 'مبلغ', key: 'price', width: 18 },
    ];
    for (const detail of details) detailSheet.addRow(detail);
    const totalRow = detailSheet.addRow({
      serviceName: 'جمع کل',
      price: summary.totalRevenue,
    });
    totalRow.font = { bold: true };
    detailSheet.autoFilter = `A1:H${Math.max(1, detailSheet.rowCount - 1)}`;

    for (const sheet of [summarySheet, detailSheet]) {
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF235C46' },
      };
      sheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.eachRow((row) => {
        row.alignment = { ...row.alignment, vertical: 'middle' };
      });
    }
    summarySheet.getRow(9).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    summarySheet.getRow(9).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF35785D' },
    };
    summarySheet.getColumn(1).width = 24;
    summarySheet.getColumn(2).width = 22;
    summarySheet.getColumn(3).width = 16;
    summarySheet.getColumn(4).width = 20;
    summarySheet.getColumn(5).width = 22;
    summarySheet.getCell('B5').numFmt = TOMAN_FORMAT;
    summarySheet.getCell('B7').numFmt = TOMAN_FORMAT;
    summarySheet.getColumn(5).numFmt = TOMAN_FORMAT;
    detailSheet.getColumn('price').numFmt = TOMAN_FORMAT;

    return workbook;
  }

  private toDetail(record: RevenueRecord, timezone: string) {
    const parts = this.localDateParts(record.startAt, timezone);
    return {
      id: record.id,
      date: `${parts.year}-${parts.month}-${parts.day}`,
      time: `${parts.hour}:${parts.minute}`,
      barberName: this.personName(record.barber.user),
      customerName: this.personName(record.customer.user),
      customerPhone: record.customer.user.phone,
      serviceName: record.service.name,
      price: Number(record.price.toString()),
    };
  }

  private personName(person: {
    phone: string;
    firstName: string | null;
    lastName: string | null;
  }) {
    return (
      [person.firstName, person.lastName].filter(Boolean).join(' ') ||
      person.phone
    );
  }

  private localMonthKey(date: Date, timezone: string) {
    const parts = this.localDateParts(date, timezone);
    return `${parts.year}-${parts.month}`;
  }

  private localDateParts(date: Date, timezone: string) {
    const values: Record<string, string> = {};
    for (const part of new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date)) {
      values[part.type] = part.value;
    }
    return values as Record<
      'year' | 'month' | 'day' | 'hour' | 'minute',
      string
    >;
  }

  private monthKeys(from: string, to: string) {
    const [fromYear, fromMonth] = from.split('-').map(Number);
    const [toYear, toMonth, toDay] = to.split('-').map(Number);
    const cursor = new Date(Date.UTC(fromYear, fromMonth - 1, 1));
    const end = new Date(Date.UTC(toYear, toMonth - 1, toDay));
    const result: string[] = [];
    while (cursor < end) {
      result.push(
        `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`,
      );
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return result;
  }

  private calendarDayNumber(value: string) {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new BadRequestException('Invalid report date');
    }
    return date.getTime() / DAY_MS;
  }

  private localMidnightToUtc(value: string, timezone: string) {
    this.calendarDayNumber(value);
    const [year, month, day] = value.split('-').map(Number);
    const guess = Date.UTC(year, month - 1, day);
    let result = new Date(guess);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      result = new Date(guess - this.timezoneOffset(result, timezone));
    }
    const local = this.localDateParts(result, timezone);
    if (
      `${local.year}-${local.month}-${local.day}` !== value ||
      local.hour !== '00'
    ) {
      throw new BadRequestException(
        'Could not resolve report date in salon timezone',
      );
    }
    return result;
  }

  private timezoneOffset(date: Date, timezone: string) {
    try {
      const parts = this.localDateParts(date, timezone);
      return (
        Date.UTC(
          Number(parts.year),
          Number(parts.month) - 1,
          Number(parts.day),
          Number(parts.hour),
          Number(parts.minute),
        ) - date.getTime()
      );
    } catch {
      throw new BadRequestException('Invalid salon timezone');
    }
  }
}
