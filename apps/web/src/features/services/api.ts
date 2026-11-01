import { api } from '../../auth/api'

export interface CreateServiceInput { salonId: string; name: string; description?: string; duration: number; price: number }
export interface SalonService extends CreateServiceInput { id: string; isActive: boolean }

export async function createService(input: CreateServiceInput) {
  return (await api.post<SalonService>('/services', input)).data
}

export async function listServices(salonId: string) { return (await api.get<SalonService[]>('/services', { params: { salonId } })).data }
export async function updateService(id: string, input: Partial<Pick<SalonService,'name'|'description'|'duration'|'price'|'isActive'>>) { return (await api.patch<SalonService>('/services/' + id, input)).data }
export async function attachBarberService(barberId: string, serviceId: string) { return (await api.post('/barbers/' + barberId + '/services/' + serviceId)).data }
export async function detachBarberService(barberId: string, serviceId: string) { return (await api.delete('/barbers/' + barberId + '/services/' + serviceId)).data }
