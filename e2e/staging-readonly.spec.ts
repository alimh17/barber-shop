import { test, expect } from '@playwright/test';

// Safe against shared staging: GET requests and client-side validation only.
// Do not add OTP requests, logins, registrations, or bookings to this suite.
test.describe('staging read-only smoke', () => {
  test('API health and correlation ID', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);
    expect(response.headers()['x-request-id']).toBeTruthy();
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.database).toBe('connected');
  });

  test('unauthenticated appointments are protected', async ({ request }) => {
    const response = await request.get('/api/appointments/mine');
    expect(response.status()).toBe(401);
  });

  test('login page validates phone locally without requesting OTP', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('#phone')).toBeVisible();
    await page.locator('#phone').fill('123');
    await page.locator('#phone').press('Enter');
    await expect(page.locator('#code')).toHaveCount(0);
  });

  test('salon registration page loads without submitting data', async ({ page }) => {
    await page.goto('/register-salon');
    await expect(page).toHaveURL(/register-salon/);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('protected dashboard redirects to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/login/);
  });
});
