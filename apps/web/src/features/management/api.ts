import { api } from '../../auth/api';
import type { UserRole } from '../../auth/types';
import { formatNumber, formatPersianDate } from '../../lib/locale';

export type AppointmentStatus =
  'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export interface PersonRef {
  phone: string;
  firstName?: string | null;
  lastName?: string | null;
}

export interface AppointmentRecord {
  id: string;
  salonId: string;
  startAt: string;
  endAt: string;
  price: string;
  duration: number;
  status: AppointmentStatus;
  note?: string | null;
  customer?: { id: string; user?: PersonRef | null } | null;
  barber?: { id: string; user?: PersonRef | null } | null;
  service?: { id: string; name: string } | null;
  salon?: { id: string; name: string } | null;
}

export interface ManagedUser {
  id: string;
  phone: string;
  firstName?: string | null;
  lastName?: string | null;
  role: UserRole;
  status: string;
  createdAt: string;
  barber?: { id: string; salonId: string; isActive: boolean } | null;
}

export interface Paged<T> {
  items: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface BarberServiceItem {
  barberId: string;
  serviceId: string;
  service: {
    id: string;
    name: string;
    duration: number;
    price: string;
    isActive: boolean;
  };
}

export interface AvailabilitySlot {
  startAt: string;
  endAt: string;
  localStart: string;
  localEnd: string;
}

export interface AvailabilityResponse {
  dayOff: boolean;
  slots: AvailabilitySlot[];
}

export const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  PENDING: 'در انتظار تأیید',
  CONFIRMED: 'تأیید شده',
  COMPLETED: 'تکمیل شده',
  CANCELLED: 'لغو شده',
  NO_SHOW: 'عدم مراجعه',
};

export const statusActionLabels: Record<AppointmentStatus, string> = {
  PENDING: 'برگشت به انتظار',
  CONFIRMED: 'تأیید نوبت',
  COMPLETED: 'ثبت تکمیل',
  CANCELLED: 'لغو نوبت',
  NO_SHOW: 'عدم مراجعه',
};

// Allowed transitions mirror the backend state machine (AppointmentsService).
export const nextStatuses: Record<AppointmentStatus, AppointmentStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'NO_SHOW', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export const userStatusLabels: Record<string, string> = {
  ACTIVE: 'فعال',
  INACTIVE: 'غیرفعال',
  BLOCKED: 'مسدود',
};

export function personName(person?: PersonRef | null) {
  if (!person) return '—';
  return (
    [person.firstName, person.lastName].filter(Boolean).join(' ') ||
    person.phone
  );
}

const DEFAULT_TIMEZONE = 'Asia/Tehran';
const salonTimezones = new Map<string, string>();
let activeTimezone = DEFAULT_TIMEZONE;

export function setActiveSalonTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    activeTimezone = timezone;
  } catch {
    activeTimezone = DEFAULT_TIMEZONE;
  }
}

export async function loadSalonTimezone(salonId: string) {
  if (!salonId) return DEFAULT_TIMEZONE;
  if (!salonTimezones.has(salonId)) {
    const { data } = await api.get<{ timezone: string }>(`/salons/${salonId}`);
    salonTimezones.set(salonId, data.timezone || DEFAULT_TIMEZONE);
  }
  return salonTimezones.get(salonId) ?? DEFAULT_TIMEZONE;
}

/** YYYY-MM-DD in the salon timezone. */
export function tehranDate(value: string | Date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: activeTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

export function tehranTime(value: string) {
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    timeZone: activeTimezone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function tehranLongDate(value: Date = new Date()) {
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    timeZone: activeTimezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(value);
}

export function tehranDisplayDate(value: string | Date) {
  return formatPersianDate(value, activeTimezone);
}

export function formatToman(price: string | number) {
  return `${formatNumber(Math.round(Number(price)))} تومان`;
}

export async function listUsers(params: {
  role?: UserRole;
  search?: string;
  page?: number;
  limit?: number;
}) {
  return (await api.get<Paged<ManagedUser>>('/users', { params })).data;
}

export async function listAppointments() {
  return (await api.get<AppointmentRecord[]>('/appointments')).data;
}

export async function changeAppointmentStatus(
  id: string,
  status: AppointmentStatus,
) {
  return (
    await api.patch<AppointmentRecord>(`/appointments/${id}/status`, { status })
  ).data;
}

export async function createAdminAppointment(input: {
  customerId: string;
  barberId: string;
  serviceId: string;
  startAt: string;
  note?: string;
}) {
  return (await api.post<AppointmentRecord>('/appointments/admin', input)).data;
}

export async function getAvailability(params: {
  salonId: string;
  barberId: string;
  serviceId: string;
  date: string;
}) {
  return (await api.get<AvailabilityResponse>('/availability', { params }))
    .data;
}

export async function getBarberServices(barberId: string) {
  return (await api.get<BarberServiceItem[]>(`/barbers/${barberId}/services`))
    .data;
}

export async function setBarberActive(barberId: string, isActive: boolean) {
  return (await api.patch(`/barbers/${barberId}`, { isActive })).data;
}

export interface PublicSalon {
  id: string;
  name: string;
  timezone: string;
}
export interface PublicBarber {
  id: string;
  salonId: string;
  isActive: boolean;
  user: PersonRef;
}
export async function getSalons() {
  return (await api.get<PublicSalon[]>('/salons')).data;
}
export async function getPublicBarbers(salonId: string) {
  return (await api.get<PublicBarber[]>('/barbers', { params: { salonId } }))
    .data;
}
export async function bookAppointment(input: {
  barberId: string;
  serviceId: string;
  startAt: string;
  note?: string;
}) {
  return (await api.post<AppointmentRecord>('/appointments', input)).data;
}
export async function myAppointments() {
  return (await api.get<AppointmentRecord[]>('/appointments/mine')).data;
}
