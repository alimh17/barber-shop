import { api } from '../../auth/api'

export interface CreateServiceInput { salonId: string; name: string; description?: string; duration: number; price: number }
export interface SalonService extends CreateServiceInput { id: string; isActive: boolean }

export async function createService(input: CreateServiceInput) {
  return (await api.post<SalonService>('/services', input)).data
}
