import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from './App';

function renderApp(path = '/dashboard') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('application routing', () => {
  beforeEach(() => {
    localStorage.clear();
    // These are routing tests; keep background API queries from changing auth
    // state while a route assertion is in progress.
    onlineManager.setOnline(false);
  });
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });
  afterAll(() => onlineManager.setOnline(true));

  it('redirects unauthenticated users to the OTP login page', async () => {
    renderApp();
    expect(
      await screen.findByRole('heading', { name: 'خوش آمدید' }),
    ).toBeInTheDocument();
  });

  it('renders the dashboard when the backend user has no fullName', async () => {
    localStorage.setItem(
      'barbershop.session.v1',
      JSON.stringify({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 60_000,
        user: { id: 'user-1', phone: '09120000000', role: 'ADMIN' },
      }),
    );
    renderApp();
    expect(
      await screen.findByRole('heading', { name: /سلام، دوست عزیز/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'نوبت‌های امروز' }),
    ).toBeInTheDocument();
  });

  it('renders the dashboard for a newly registered customer without a redirect loop', async () => {
    localStorage.setItem(
      'barbershop.session.v1',
      JSON.stringify({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 60_000,
        user: { id: 'customer-1', phone: '09121111111', role: 'CUSTOMER' },
      }),
    );
    renderApp();
    expect(
      await screen.findByRole('heading', { name: /سلام، دوست عزیز/ }),
    ).toBeInTheDocument();
  });

  it('allows only a super administrator to open the create-salon form', async () => {
    localStorage.setItem(
      'barbershop.session.v1',
      JSON.stringify({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 60_000,
        user: { id: 'root-1', phone: '09120000000', role: 'SUPER_ADMIN' },
      }),
    );
    renderApp('/salons/new');
    expect(
      await screen.findByRole('heading', { name: 'ایجاد سالن جدید' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'ایجاد سالن' }),
    ).toBeInTheDocument();
  });

  it('shows a visible create-salon action on the super-admin dashboard', async () => {
    localStorage.setItem(
      'barbershop.session.v1',
      JSON.stringify({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 60_000,
        user: { id: 'root-1', phone: '09120000000', role: 'SUPER_ADMIN' },
      }),
    );
    renderApp();
    expect(
      await screen.findByRole('link', { name: /ایجاد سالن جدید/ }),
    ).toHaveAttribute('href', '/salons/new');
  });

  it('redirects a regular administrator away from the create-salon form', async () => {
    localStorage.setItem(
      'barbershop.session.v1',
      JSON.stringify({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 60_000,
        user: { id: 'admin-1', phone: '09121111111', role: 'ADMIN' },
      }),
    );
    renderApp('/salons/new');
    expect(
      await screen.findByRole('heading', { name: /سلام، دوست عزیز/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'ایجاد سالن جدید' }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ['/services/new', 'ایجاد خدمت جدید', 'ایجاد خدمت'],
    ['/barbers/new', 'ایجاد آرایشگر جدید', 'ایجاد آرایشگر'],
  ])(
    'allows an administrator to open %s',
    async (path, heading, submitLabel) => {
      localStorage.setItem(
        'barbershop.session.v1',
        JSON.stringify({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresAt: Date.now() + 60_000,
          user: { id: 'admin-1', phone: '09121111111', role: 'ADMIN' },
        }),
      );
      renderApp(path);
      expect(
        await screen.findByRole('heading', { name: heading }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: submitLabel }),
      ).toBeInTheDocument();
    },
  );

  it.each(['/services/new', '/barbers/new'])(
    'redirects a customer away from %s',
    async (path) => {
      localStorage.setItem(
        'barbershop.session.v1',
        JSON.stringify({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresAt: Date.now() + 60_000,
          user: { id: 'customer-1', phone: '09121111111', role: 'CUSTOMER' },
        }),
      );
      renderApp(path);
      expect(
        await screen.findByRole('heading', { name: /سلام، دوست عزیز/ }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { name: /ایجاد (خدمت|آرایشگر) جدید/ }),
      ).not.toBeInTheDocument();
    },
  );

  it('allows an administrator to open the revenue report', async () => {
    localStorage.setItem(
      'barbershop.session.v1',
      JSON.stringify({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 60_000,
        user: { id: 'admin-1', phone: '09121111111', role: 'ADMIN' },
      }),
    );
    renderApp('/reports/revenue');
    expect(
      await screen.findByRole('heading', { name: 'گزارش درآمد' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /خروجی Excel/ }),
    ).toBeInTheDocument();
  });

  it('redirects a customer away from the revenue report', async () => {
    localStorage.setItem(
      'barbershop.session.v1',
      JSON.stringify({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 60_000,
        user: { id: 'customer-1', phone: '09121111111', role: 'CUSTOMER' },
      }),
    );
    renderApp('/reports/revenue');
    expect(
      await screen.findByRole('heading', { name: /سلام، دوست عزیز/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'گزارش درآمد' }),
    ).not.toBeInTheDocument();
  });

  it('allows a signed-in customer to open notification settings', async () => {
    localStorage.setItem(
      'barbershop.session.v1',
      JSON.stringify({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 60_000,
        user: { id: 'customer-1', phone: '09121111111', role: 'CUSTOMER' },
      }),
    );
    renderApp('/settings/notifications');
    expect(
      await screen.findByRole('heading', { name: 'اعلان‌های دستگاه' }),
    ).toBeInTheDocument();
  });

  it('allows every signed-in user to open their own profile', async () => {
    localStorage.setItem(
      'barbershop.session.v1',
      JSON.stringify({
        accessToken: 'access-token',
        expiresAt: Date.now() + 60_000,
        user: { id: 'customer-1', phone: '09121111111', role: 'CUSTOMER' },
      }),
    );
    renderApp('/profile');
    expect(
      await screen.findByRole('heading', { name: 'پروفایل من' }),
    ).toBeInTheDocument();
  });
});
