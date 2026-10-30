import { api } from '../../auth/api';
import type { UserRole } from '../../auth/types';

export interface UserProfile {
  id: string;
  phone: string;
  firstName: string | null;
  lastName: string | null;
  birthDate: string | null;
  role: UserRole;
  status: string;
}

export async function getProfile(userId: string) {
  return (await api.get<UserProfile>(`/users/${userId}`)).data;
}

export async function updateProfile(
  userId: string,
  input: { firstName: string; lastName: string; birthDate: string },
) {
  return (await api.patch<UserProfile>(`/users/${userId}`, input)).data;
}
