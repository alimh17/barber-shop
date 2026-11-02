import { test, expect } from '@playwright/test'

const phone = process.env.E2E_PHONE
const otp = process.env.E2E_OTP

test('login validates phone number', async ({ page }) => {
  await page.goto('/login')
  await expect(page.locator('#phone')).toBeVisible()
  await page.locator('#phone').fill('123')
  await page.locator('#phone').press('Enter')
  await expect(page.locator('#code')).toHaveCount(0)
})

test('OTP login sets HttpOnly cookie', async ({ page }) => {
  test.skip(!phone || (!otp && process.env.E2E_ISOLATED !== '1'), 'Requires E2E_PHONE and isolated development OTP or explicit E2E_OTP')
  const salonSlug = process.env.E2E_SALON_SLUG
  await page.goto(salonSlug ? `/login?salon=${encodeURIComponent(salonSlug)}` : '/login')
  await page.locator('#phone').fill(phone!)
  await page.locator('#phone').press('Enter')
  await expect(page.locator('#code')).toBeVisible()
  const code = otp ?? (await page.locator('.demo-hint b').textContent())?.trim()
  expect(code, 'Only the isolated mock-SMS environment may expose OTP').toBeTruthy()
  await page.locator('#code').fill(code!)
  await page.locator('#code').press('Enter')
  await expect(page).toHaveURL(/\/dashboard/)
  const cookies = await page.context().cookies()
  expect(cookies.some(c => c.name === 'barbershop_refresh' && c.httpOnly)).toBe(true)
})
