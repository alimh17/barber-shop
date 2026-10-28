# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: booking-security.spec.ts >> duplicate booking, cancellation, and role access (real API)
- Location: e2e\booking-security.spec.ts:20:1

# Error details

```
Error: expect(received).toBeTruthy()

Received: false
```

# Test source

```ts
  1  | import { test, expect, type APIRequestContext } from '@playwright/test'
  2  | 
  3  | const apiBase = process.env.E2E_API_URL ?? 'http://127.0.0.1:3000/api'
  4  | const ids = {
  5  |   salonId: 'e409b649-2225-43f4-a20d-d7e94ec8518f',
  6  |   barberId: '0fb2982d-044d-493f-a7cb-daebfd70bbc8',
  7  |   serviceId: '0869aea3-2701-4403-9f3f-ed6b27fe86a7',
  8  | }
  9  | async function token(request: APIRequestContext, phone: string) {
  10 |   const otpResponse = await request.post(apiBase + '/auth/request-otp', { data: { phone } })
> 11 |   expect(otpResponse.ok()).toBeTruthy()
     |                            ^ Error: expect(received).toBeTruthy()
  12 |   const otp = (await otpResponse.json()).otp
  13 |   expect(otp, 'Test requires development OTP, never use production').toBeTruthy()
  14 |   const response = await request.post(apiBase + '/auth/verify-otp', { data: { phone, code: otp } })
  15 |   expect(response.ok()).toBeTruthy()
  16 |   return (await response.json()).accessToken as string
  17 | }
  18 | const auth = (value: string) => ({ Authorization: 'Bearer ' + value })
  19 | 
  20 | test('duplicate booking, cancellation, and role access (real API)', async ({ request }) => {
  21 |   test.setTimeout(90000)
  22 |   const customer = await token(request, '09120000981')
  23 |   const barber = await token(request, '09120000982')
  24 |   const date = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10)
  25 |   const url = new URL(apiBase + '/availability')
  26 |   for (const [key, value] of Object.entries({ ...ids, date })) url.searchParams.set(key, value)
  27 |   const available = await request.get(url.toString(), { headers: auth(customer) })
  28 |   expect(available.ok()).toBeTruthy()
  29 |   const slots = (await available.json()).slots as Array<{startAt: string}>
  30 |   expect(slots.length).toBeGreaterThan(0)
  31 |   const payload = { barberId: ids.barberId, serviceId: ids.serviceId, startAt: slots[0].startAt }
  32 | 
  33 |   await test.step('customer can create pending booking', async () => {
  34 |     const result = await request.post(apiBase + '/appointments', { headers: auth(customer), data: payload })
  35 |     expect(result.status()).toBe(201)
  36 |     const appointment = await result.json()
  37 |     expect(appointment.status).toBe('PENDING')
  38 |     test.info().annotations.push({ type: 'created-appointment', description: appointment.id })
  39 |   })
  40 |   const mine = await request.get(apiBase + '/appointments/mine', { headers: auth(customer) })
  41 |   expect(mine.ok()).toBeTruthy()
  42 |   const created = (await mine.json()).find((item: {startAt:string;barberId:string;status:string}) =>
  43 |     item.startAt === payload.startAt && item.barberId === ids.barberId && item.status === 'PENDING')
  44 |   expect(created).toBeTruthy()
  45 | 
  46 |   await test.step('same slot cannot be booked twice', async () => {
  47 |     const duplicate = await request.post(apiBase + '/appointments', { headers: auth(customer), data: payload })
  48 |     expect(duplicate.status()).toBe(409)
  49 |   })
  50 |   await test.step('customer cannot list all or change appointment status', async () => {
  51 |     const list = await request.get(apiBase + '/appointments', { headers: auth(customer) })
  52 |     expect(list.status()).toBe(403)
  53 |     const update = await request.patch(apiBase + '/appointments/' + created.id + '/status', {
  54 |       headers: auth(customer), data: { status: 'CONFIRMED' },
  55 |     })
  56 |     expect(update.status()).toBe(403)
  57 |     const unauthenticated = await request.get(apiBase + '/appointments/mine')
  58 |     expect(unauthenticated.status()).toBe(401)
  59 |   })
  60 |   await test.step('barber can cancel assigned pending appointment', async () => {
  61 |     const cancelled = await request.patch(apiBase + '/appointments/' + created.id + '/status', {
  62 |       headers: auth(barber), data: { status: 'CANCELLED' },
  63 |     })
  64 |     expect(cancelled.ok()).toBeTruthy()
  65 |     expect((await cancelled.json()).status).toBe('CANCELLED')
  66 |     const mineAfter = await request.get(apiBase + '/appointments/mine', { headers: auth(customer) })
  67 |     expect((await mineAfter.json()).find((a: {id:string}) => a.id === created.id).status).toBe('CANCELLED')
  68 |   })
  69 |   await test.step('cancelled time slot can be booked again', async () => {
  70 |     const replacement = await request.post(apiBase + '/appointments', { headers: auth(customer), data: payload })
  71 |     expect(replacement.status()).toBe(201)
  72 |     expect((await replacement.json()).status).toBe('PENDING')
  73 |   })
  74 | })
  75 | 
```