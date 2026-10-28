import { test, expect } from '@playwright/test'

test('salon invitation opens its login page', async ({ page }) => {
  await page.goto('/s/e2e-playwright-salon')
  await expect(page).toHaveURL(/login\?salon=e2e-playwright-salon/)
})

test('customer sees only the assigned salon in booking UI', async ({ page }) => {
  await page.goto('/s/e2e-playwright-salon')
  await page.locator('#phone').fill('09120000993')
  await page.locator('#phone').press('Enter')
  await expect(page.locator('#code')).toBeVisible()
  const otp = (await page.locator('.demo-hint b').textContent())?.trim()
  expect(otp).toBeTruthy()
  await page.locator('#code').fill(otp!)
  await page.locator('#code').press('Enter')
  await expect(page).toHaveURL(/dashboard/)
  await page.goto('/book')
  const salon = page.getByRole('combobox', { name: 'سالن' })
  await expect(salon.locator('option')).toHaveCount(2)
  await expect(salon.locator('option', { hasText: 'E2E Second Salon' })).toHaveCount(0)
  await salon.selectOption({ label: 'E2E Test Salon' })
  const barber = page.getByRole('combobox', { name: 'آرایشگر' })
  await expect(barber.locator('option', { hasText: 'E2E Barber' })).toHaveCount(2)
  await expect(barber.locator('option', { hasText: 'E2E BarberB' })).toHaveCount(0)
})
