import { createContext, use } from 'react'
import type { Session } from './types'
import { requestOtp } from './api'

export interface AuthValue {
  session: Session | null
  ready: boolean
  sendOtp: typeof requestOtp
  signIn: (phone: string, code: string) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthValue | null>(null)

export function useAuth() {
  const value = use(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
