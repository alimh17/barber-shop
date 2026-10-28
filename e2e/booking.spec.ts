import { test, expect, type Page } from '@playwright/test'

const customerPhone = process.env.E2E_CUSTOMER_PHONE
const barberPhone = process.env.E2E_BARBER_PHONE
const salonName = process.env.E2E_SALON_NAME
const serviceName = process.env.E2E_SERVICE_NAME
const barberName = process.env.E2E_BARBER_NAME

async function login(page: Page, phone: string) {
  await page.goto('/login')
  await page.locator('#phone').fill(phone)
  await page.locator('#phone').press('Enter')
  await expect(page.locator('#code')).toBeVisible()
  const code = (await page.locator('.demo-hint b').textContent().catch(() => null))?.trim()
  if (!code) throw new Error('Development OTP is required. Do not run against production.')
  await page.locator('#code').fill(code)
  await page.locator('#code').press('Enter')
  await expect(page).toHaveURL(/\/dashboard/)
}

test('customer requests an appointment and assigned barber confirms it (real API)', async ({ browser }) => {
  test.skip(!customerPhone || !barberPhone || !salonName || !serviceName || !barberName,
    'Set all E2E fixture environment variables on isolated test DB')
  test.setTimeout(90000)
  const customer = await browser.newContext()
  const barber = await browser.newContext()
  try {
    const customerPage = await customer.newPage()
    await login(customerPage, customerPhone!)
    await customerPage.goto('/book')
    await customerPage.getByRole('combobox', { name: 'سالن' }).selectOption({ label: salonName! })
    await customerPage.getByRole('combobox', { name: 'آرایشگر' }).selectOption({ label: barberName! })
    await customerPage.getByRole('combobox', { name: 'خدمت' }).selectOption({ label: serviceName! })
    const future = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10)
    await customerPage.getByLabel('تاریخ').fill(future)
    const slots = customerPage.locator('.slot-grid button')
    await expect(slots.first()).toBeVisible({ timeout: 15000 })
    await slots.first().click()
    await customerPage.getByRole('button', { name: 'ثبت درخواست نوبت' }).click()
    await expect(customerPage.getByText('در انتظار تأیید').first()).toBeVisible()

    const barberPage = await barber.newPage()
    await login(barberPage, barberPhone!)
    await barberPage.goto('/appointments')
    const row = barberPage.locator('.mgmt-card').filter({ hasText: 'E2E Customer' }).filter({ hasText: 'در انتظار تأیید' }).first()
    await expect(row).toBeVisible({ timeout: 15000 })
    await row.getByRole('button', { name: 'تأیید نوبت' }).click()
    await expect(barberPage.locator('.mgmt-card').filter({ hasText: 'E2E Customer' }).filter({ hasText: 'تأیید شده' }).first()).toBeVisible()
    await customerPage.reload()
    await expect(customerPage.getByText('تأیید شده').first()).toBeVisible()
  } finally {
    await Promise.allSettled([customer.close(), barber.close()])
  }
})
