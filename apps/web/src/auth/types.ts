export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'BARBER' | 'CUSTOMER';
export interface User {
  id: string;
  phone: string;
  role: UserRole;
  firstName?: string | null;
  lastName?: string | null;
  birthDate?: string | null;
  fullName?: string;
}
export interface Session {
  accessToken: string;
  expiresAt: number;
  user: User;
}
export interface AuthResponse {
  accessToken: string;
  user: User;
}
