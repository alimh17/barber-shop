import type { Session } from './types'
const SESSION_KEY = 'barbershop.session.v1'
export function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as Session
    if (!session?.user?.id || !session.user.phone || !session.user.role) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return session
  } catch {
    localStorage.removeItem(SESSION_KEY)
    return null
  }
}
export function writeSession(session: Session) { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); window.dispatchEvent(new CustomEvent('auth:session', { detail: session })) }
export function clearSession() { localStorage.removeItem(SESSION_KEY); window.dispatchEvent(new CustomEvent('auth:session', { detail: null })) }
