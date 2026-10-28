export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'BARBER' | 'CUSTOMER'
export interface User { id: string; phone: string; role: UserRole; fullName?: string }
export interface Session { accessToken: string; expiresAt: number; user: User }
export interface AuthResponse { accessToken: string; user: User }
