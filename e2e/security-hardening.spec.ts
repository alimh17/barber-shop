import { test, expect } from '@playwright/test'

const api = process.env.E2E_API_URL ?? 'http://127.0.0.1:3000/api'
test.describe('Isolated security regression', () => {
  test('rejects unauthenticated access to private resources', async ({ request }) => {
    for (const path of ['/auth/me', '/appointments', '/appointments/mine']) {
      const response = await request.get(api + path)
      expect(response.status(), path).toBe(401)
    }
  })

  test('does not grant CORS to untrusted origins', async ({ request }) => {
    const origin = 'https://untrusted.example.invalid'
    const response = await request.get(api + '/health', { headers: { Origin: origin } })
    expect(response.status()).toBe(200)
    expect(response.headers()['access-control-allow-origin']).not.toBe(origin)
    const preflight = await request.fetch(api + '/auth/refresh', { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' } })
    expect(preflight.headers()['access-control-allow-origin']).not.toBe(origin)
  })

  test('rejects refresh without a valid cookie, including foreign origin', async ({ request }) => {
    for (const origin of ['https://untrusted.example.invalid', undefined]) {
      const response = await request.post(api + '/auth/refresh', { headers: origin ? { Origin: origin } : {} })
      expect(response.status()).toBe(origin ? 403 : 401)
    }
  })

  test('enforces OTP per-phone limit over real HTTP', async ({ request }) => {
    test.setTimeout(45000)
    const phone = '09120000777'
    const codes: number[] = []
    for (let i = 0; i < 6; i++) {
      const response = await request.post(api + '/auth/request-otp', { data: { phone, salonSlug: 'e2e-playwright-salon' } })
      codes.push(response.status())
    }
    expect(codes.slice(0, 5).every(code => code !== 429)).toBe(true)
    expect(codes[5]).toBe(429)
  })

  test('does not reflect HTML payload in JSON error response', async ({ request }) => {
    const marker = '<security-test-marker data-check="escaped">'
    const response = await request.get(api + '/salons?search=' + encodeURIComponent(marker))
    const contentType = response.headers()['content-type'] ?? ''
    expect(contentType).not.toContain('text/html')
    const body = await response.text()
    expect(body).not.toContain(marker)
  })
})

const salonA = 'e2e-playwright-salon'
const salonB = 'e2e-playwright-salon-b'
async function login(request: import('@playwright/test').APIRequestContext, phone: string, salonSlug = salonA) {
  const otp = await request.post(api + '/auth/request-otp', { data: { phone, salonSlug } })
  expect(otp.status()).toBe(201)
  const code = (await otp.json()).otp
  expect(code, 'Only isolated mock OTP is supported').toBeTruthy()
  const verified = await request.post(api + '/auth/verify-otp', { data: { phone, code, salonSlug } })
  expect(verified.status()).toBe(201)
  return { response: verified, headers: { Authorization: 'Bearer ' + (await verified.json()).accessToken } }
}

test('IDOR: customer and admin cannot read or mutate foreign salon resources', async ({ request }) => {
  test.setTimeout(60000)
  const customer = await login(request, '09120000981')
  const admin = await login(request, '09120000983')
  const foreignSalon = '45a736f3-71f9-4d61-b0d4-95c78a121b66'
  const foreignBarber = '59d14e95-83fc-450c-b273-21a9e32754aa'
  for (const headers of [customer.headers, admin.headers]) {
    expect([403, 404]).toContain((await request.get(api + '/salons/' + foreignSalon, { headers })).status())
    expect([403, 404]).toContain((await request.get(api + '/barbers?salonId=' + foreignSalon, { headers })).status())
    expect([403, 404]).toContain((await request.get(api + '/barbers/' + foreignBarber + '/services', { headers })).status())
  }
})

test('CSRF: cross-origin refresh with a real session cookie', async ({ request }) => {
  const logged = await login(request, '09120000981')
  const setCookie = logged.response.headers()['set-cookie'] ?? ''
  expect(setCookie).toContain('barbershop_refresh=')
  expect(setCookie.toLowerCase()).toContain('httponly')
  expect(setCookie.toLowerCase()).toContain('samesite=strict')
  const cookie = setCookie.split(';')[0]
  const response = await request.post(api + '/auth/refresh', {
    headers: { Origin: 'https://untrusted.example.invalid', Cookie: cookie },
  })
  expect([401, 403]).toContain(response.status())
})

test('stored XSS: salon registration description remains inert on browser rendering', async ({ page, request }) => {
  test.setTimeout(60000)
  const logged = await login(request, '09120000983')
  const marker = '<img src=x onerror=window.__security_xss_marker=1>'
  const salon = await request.get(api + '/salons', { headers: logged.headers })
  expect(salon.status()).toBe(200)
  const own = (await salon.json())[0]
  expect(own).toBeTruthy()
  const update = await request.patch(api + '/salons/' + own.id, { headers: logged.headers, data: { description: marker } })
  expect(update.status()).toBe(200)
  await page.goto('/')
  await page.waitForTimeout(300)
  expect(await page.evaluate(() => (window as Window & { __security_xss_marker?: number }).__security_xss_marker ?? 0)).toBe(0)
})

test('DOM XSS: malicious query string does not execute in login page', async ({ page }) => {
  await page.goto('/login?salon=' + encodeURIComponent('<img src=x onerror=window.__security_xss_marker=1>'), { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(300)
  expect(await page.evaluate(() => (window as Window & { __security_xss_marker?: number }).__security_xss_marker ?? 0)).toBe(0)
})

test('OTP rate limit counts distinct phone numbers against same IP', async ({ request }) => {
  test.setTimeout(60000)
  const codes: number[] = []
  for (let i = 0; i < 21; i++) {
    const phone = '091200' + String(60000 + i)
    const result = await request.post(api + '/auth/request-otp', { data: { phone, salonSlug: salonA } })
    codes.push(result.status())
  }
  expect(codes.some(code => code === 429)).toBe(true)
  expect(codes[codes.length - 1]).toBe(429)
})





