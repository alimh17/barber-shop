import { api } from '../../auth/api';

export interface Salon {
  id: string;
  name: string;
  slug: string;
  phone?: string | null;
  address?: string | null;
  timezone: string;
  isActive: boolean;
}

export interface Barber {
  id: string;
  salonId: string;
  isActive: boolean;
  user: {
    id: string;
    phone: string;
    firstName?: string | null;
    lastName?: string | null;
  };
}

export interface CreateSalonInput {
  name: string;
  slug: string;
  phone?: string;
  address?: string;
  description?: string;
  timezone?: string;
  isActive?: boolean;
}

export interface CreateBarberInput {
  salonId: string;
  phone: string;
  firstName?: string;
  lastName?: string;
}

export async function getSalons() {
  return (await api.get<Salon[]>('/salons')).data;
}

export async function getBarbers(salonId: string) {
  return (await api.get<Barber[]>('/barbers', { params: { salonId } })).data;
}

export async function createSalon(input: CreateSalonInput) {
  return (await api.post<Salon>('/salons', input)).data;
}

export async function createBarber(input: CreateBarberInput) {
  return (await api.post<Barber>('/barbers', input)).data;
}

export interface SalonSmsConfig {
  configured: boolean;
  verifyTemplate?: string;
  apiKeyLast4?: string;
  isActive?: boolean;
  updatedAt?: string;
}

export async function getSalonSmsConfig(salonId: string) {
  return (await api.get<SalonSmsConfig>(`/salons/${salonId}/sms-config`)).data;
}

export async function updateSalonSmsConfig(
  salonId: string,
  input: { apiKey: string; verifyTemplate: string; isActive: boolean },
) {
  return (
    await api.patch<SalonSmsConfig>(`/salons/${salonId}/sms-config`, input)
  ).data;
}

export async function disableSalonSmsConfig(salonId: string) {
  return (await api.delete<SalonSmsConfig>(`/salons/${salonId}/sms-config`))
    .data;
}
