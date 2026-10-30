import { api } from '../../auth/api';

export interface MyRevenueReport {
  period: 'day' | 'week' | 'month';
  timezone: string;
  totalRevenue: number;
  appointmentCount: number;
  buckets: Array<{ key: string; revenue: number; appointments: number }>;
}

export async function getMyRevenue(period: 'day' | 'week' | 'month') {
  return (await api.get<MyRevenueReport>('/reports/my-revenue', { params: { period } })).data;
}

export interface RevenueReport {
  salon: { id: string; name: string; slug: string; timezone: string };
  period: { from: string; to: string; timezone: string };
  totalRevenue: number;
  appointmentCount: number;
  averageAppointmentRevenue: number;
  byBarber: Array<{
    barberId: string;
    barberName: string;
    phone: string;
    isActive: boolean;
    revenue: number;
    appointmentCount: number;
  }>;
  byMonth: Array<{
    month: string;
    revenue: number;
    appointmentCount: number;
  }>;
  details: {
    items: Array<{
      id: string;
      date: string;
      time: string;
      barberName: string;
      customerName: string;
      customerPhone: string;
      serviceName: string;
      price: number;
    }>;
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export interface RevenueParams {
  salonId: string;
  from: string;
  to: string;
  page?: number;
  limit?: number;
}

export async function getRevenueReport(params: RevenueParams) {
  return (await api.get<RevenueReport>('/reports/revenue', { params })).data;
}

export async function downloadRevenueReport(
  params: Omit<RevenueParams, 'page' | 'limit'>,
) {
  const response = await api.get<Blob>('/reports/revenue/export', {
    params,
    responseType: 'blob',
  });
  const disposition = response.headers['content-disposition'] as
    string | undefined;
  const filename =
    disposition?.match(/filename="?([^";]+)"?/i)?.[1] ??
    `revenue-${params.from}-${params.to}.xlsx`;
  return { blob: response.data, filename };
}
