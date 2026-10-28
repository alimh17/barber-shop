import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../dist/generated/prisma/client.js'

if (process.env.E2E_ALLOW_SEED !== 'yes') {
  throw new Error('Set E2E_ALLOW_SEED=yes explicitly for test fixture creation')
}
const url = new URL(process.env.DATABASE_URL ?? '')
if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
  throw new Error('Refusing to seed non-local database')
}
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })
const customerPhone = '09120000981'
const barberPhone = '09120000982'
const salonName = 'E2E Test Salon'
const barberName = 'E2E Barber'
const serviceName = 'E2E Haircut'

try {
  const result = await db.$transaction(async (tx) => {
    const salon = await tx.salon.upsert({
      where: { slug: 'e2e-playwright-salon' },
      update: { name: salonName, isActive: true },
      create: { slug: 'e2e-playwright-salon', name: salonName, timezone: 'Asia/Tehran' },
    })
    const customerUser = await tx.user.upsert({
      where: { phone: customerPhone },
      update: { role: 'CUSTOMER', status: 'ACTIVE' },
      create: { phone: customerPhone, role: 'CUSTOMER', firstName: 'E2E', lastName: 'Customer' },
    })
    await tx.customer.upsert({
      where: { userId: customerUser.id },
      update: {},
      create: { userId: customerUser.id },
    })
    await tx.salonMembership.upsert({
      where: { userId_salonId: { userId: customerUser.id, salonId: salon.id } },
      update: { isActive: true },
      create: { userId: customerUser.id, salonId: salon.id },
    })
    const barberUser = await tx.user.upsert({
      where: { phone: barberPhone },
      update: { role: 'BARBER', status: 'ACTIVE', firstName: 'E2E', lastName: 'Barber' },
      create: { phone: barberPhone, role: 'BARBER', firstName: 'E2E', lastName: 'Barber' },
    })
    const barber = await tx.barber.upsert({
      where: { userId: barberUser.id },
      update: { salonId: salon.id, isActive: true },
      create: { userId: barberUser.id, salonId: salon.id },
    })
    let service = await tx.service.findFirst({ where: { salonId: salon.id, name: serviceName } })
    if (!service) service = await tx.service.create({
      data: { salonId: salon.id, name: serviceName, duration: 30, price: 150000 },
    })
    await tx.barberService.upsert({
      where: { barberId_serviceId: { barberId: barber.id, serviceId: service.id } },
      update: {},
      create: { barberId: barber.id, serviceId: service.id },
    })
    for (const dayOfWeek of ['SATURDAY', 'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']) {
      await tx.workingHour.upsert({
        where: { barberId_dayOfWeek: { barberId: barber.id, dayOfWeek } },
        update: { startTime: '09:00', endTime: '22:00', isActive: true },
        create: { salonId: salon.id, barberId: barber.id, dayOfWeek, startTime: '09:00', endTime: '22:00' },
      })
    }
    return { salonId: salon.id, barberId: barber.id, serviceId: service.id }
  })
  console.log(JSON.stringify({ ...result, customerPhone, barberPhone, salonName, barberName, serviceName }))
} finally {
  await db.$disconnect()
}

