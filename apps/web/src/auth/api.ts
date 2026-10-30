import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { clearSession, readSession, writeSession } from './session';
import type { AuthResponse, Session } from './types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: 12_000,
  withCredentials: true,
});
let refreshPromise: Promise<Session> | null = null;

function tokenExpiresAt(token: string) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(payload)) as { exp?: number };
    return decoded.exp ? decoded.exp * 1000 : Date.now() + 15 * 60_000;
  } catch {
    return Date.now() + 15 * 60_000;
  }
}

function toSession(response: AuthResponse): Session {
  return {
    ...response,
    user: {
      ...response.user,
      fullName:
        response.user.fullName ||
        [response.user.firstName, response.user.lastName]
          .filter(Boolean)
          .join(' ') ||
        response.user.phone,
    },
    expiresAt: tokenExpiresAt(response.accessToken),
  };
}

api.interceptors.request.use((config) => {
  const token = readSession()?.accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const request = error.config as
      (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (
      error.response?.status !== 401 ||
      !request ||
      request._retry ||
      request.url?.includes('/auth/refresh')
    )
      throw error;
    request._retry = true;
    try {
      refreshPromise ??= refreshSession().finally(() => {
        refreshPromise = null;
      });
      const session = await refreshPromise;
      request.headers.Authorization = `Bearer ${session.accessToken}`;
      return api(request);
    } catch {
      clearSession();
      throw error;
    }
  },
);

export async function requestOtp(phone: string, salonSlug?: string) {
  const { data } = await api.post<{
    message: string;
    expiresAt: string;
    otp?: string;
  }>('/auth/request-otp', { phone, salonSlug });
  const expiresIn = Math.max(
    0,
    Math.ceil((new Date(data.expiresAt).getTime() - Date.now()) / 1000),
  );
  return { expiresIn, developmentOtp: data.otp };
}

export async function verifyOtp(
  phone: string,
  code: string,
  salonSlug?: string,
) {
  const { data } = await api.post<AuthResponse>('/auth/verify-otp', {
    phone,
    code,
    salonSlug,
  });
  return toSession(data);
}

export async function refreshSession() {
  const { data } = await axios.post<AuthResponse>(
    `${api.defaults.baseURL}/auth/refresh`,
    {},
    { withCredentials: true },
  );
  const next = toSession(data);
  writeSession(next);
  return next;
}

export async function logout() {
  try {
    await api.post('/auth/logout');
  } finally {
    clearSession();
  }
}

export function getApiErrorMessage(error: unknown, fallback: string) {
  if (!axios.isAxiosError(error)) return fallback;
  const message = (
    error.response?.data as { message?: string | string[] } | undefined
  )?.message;
  return Array.isArray(message) ? message.join('، ') : (message ?? fallback);
}

export { api };
