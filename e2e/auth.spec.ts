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
  test.skip(!phone, 'Set E2E_PHONE for isolated test account')
  await page.goto('/login')
  await page.locator('#phone').fill(phone!)
  await page.locator('#phone').press('Enter')
  await expect(page.locator('#code')).toBeVisible()
  const demoCode = await page.locator('.demo-hint b').textContent().catch(() => null)
  const code = otp ?? demoCode?.trim()
  test.skip(!code, 'Set E2E_OTP or use development OTP')
  await page.locator('#code').fill(code!)
  await page.locator('#code').press('Enter')
  await expect(page).toHaveURL(/\/dashboard/)
  const cookies = await page.context().cookies()
  expect(cookies.some(c => c.name === 'barbershop_refresh' && c.httpOnly)).toBe(true)
})
