import { test, expect, type APIRequestContext } from '@playwright/test'

const apiBase = process.env.E2E_API_URL ?? 'http://127.0.0.1:3000/api'
const ids = {
  salonId: 'e409b649-2225-43f4-a20d-d7e94ec8518f',
  barberId: '0fb2982d-044d-493f-a7cb-daebfd70bbc8',
  serviceId: '0869aea3-2701-4403-9f3f-ed6b27fe86a7',
}
async function token(request: APIRequestContext, phone: string) {
  const otpResponse = await request.post(apiBase + '/auth/request-otp', { data: { phone } })
  expect(otpResponse.ok()).toBeTruthy()
  const otp = (await otpResponse.json()).otp
  expect(otp, 'Test requires development OTP, never use production').toBeTruthy()
  const response = await request.post(apiBase + '/auth/verify-otp', { data: { phone, code: otp } })
  expect(response.ok()).toBeTruthy()
  return (await response.json()).accessToken as string
}
const auth = (value: string) => ({ Authorization: 'Bearer ' + value })

test('duplicate booking, cancellation, and role access (real API)', async ({ request }) => {
  test.setTimeout(90000)
  const customer = await token(request, '09120000981')
  const barber = await token(request, '09120000982')
  const date = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10)
  const url = new URL(apiBase + '/availability')
  for (const [key, value] of Object.entries({ ...ids, date })) url.searchParams.set(key, value)
  const available = await request.get(url.toString(), { headers: auth(customer) })
  expect(available.ok()).toBeTruthy()
  const slots = (await available.json()).slots as Array<{startAt: string}>
  expect(slots.length).toBeGreaterThan(0)
  const payload = { barberId: ids.barberId, serviceId: ids.serviceId, startAt: slots[0].startAt }

  await test.step('customer can create pending booking', async () => {
    const result = await request.post(apiBase + '/appointments', { headers: auth(customer), data: payload })
    expect(result.status()).toBe(201)
    const appointment = await result.json()
    expect(appointment.status).toBe('PENDING')
    test.info().annotations.push({ type: 'created-appointment', description: appointment.id })
  })
  const mine = await request.get(apiBase + '/appointments/mine', { headers: auth(customer) })
  expect(mine.ok()).toBeTruthy()
  const created = (await mine.json()).find((item: {startAt:string;barberId:string;status:string}) =>
    item.startAt === payload.startAt && item.barberId === ids.barberId && item.status === 'PENDING')
  expect(created).toBeTruthy()

  await test.step('same slot cannot be booked twice', async () => {
    const duplicate = await request.post(apiBase + '/appointments', { headers: auth(customer), data: payload })
    expect(duplicate.status()).toBe(409)
  })
  await test.step('customer cannot list all or change appointment status', async () => {
    const list = await request.get(apiBase + '/appointments', { headers: auth(customer) })
    expect(list.status()).toBe(403)
    const update = await request.patch(apiBase + '/appointments/' + created.id + '/status', {
      headers: auth(customer), data: { status: 'CONFIRMED' },
    })
    expect(update.status()).toBe(403)
    const unauthenticated = await request.get(apiBase + '/appointments/mine')
    expect(unauthenticated.status()).toBe(401)
  })
  await test.step('barber can cancel assigned pending appointment', async () => {
    const cancelled = await request.patch(apiBase + '/appointments/' + created.id + '/status', {
      headers: auth(barber), data: { status: 'CANCELLED' },
    })
    expect(cancelled.ok()).toBeTruthy()
    expect((await cancelled.json()).status).toBe('CANCELLED')
    const mineAfter = await request.get(apiBase + '/appointments/mine', { headers: auth(customer) })
    expect((await mineAfter.json()).find((a: {id:string}) => a.id === created.id).status).toBe('CANCELLED')
  })
  await test.step('cancelled time slot can be booked again', async () => {
    const replacement = await request.post(apiBase + '/appointments', { headers: auth(customer), data: payload })
    expect(replacement.status()).toBe(201)
    expect((await replacement.json()).status).toBe('PENDING')
  })
})
