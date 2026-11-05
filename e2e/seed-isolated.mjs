import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../dist/generated/prisma/client.js'

const url = new URL(process.env.DATABASE_URL ?? '')
if (process.env.E2E_ALLOW_SEED !== 'yes' ||
    process.env.NODE_ENV !== 'test' ||
    url.hostname !== 'postgres' ||
    url.pathname !== '/barbershop_e2e' ||
    url.username !== 'e2e') {
  throw new Error('Refusing to seed: only isolated Docker E2E database is permitted')
}
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) })
const ids = {
  salonA: 'e409b649-2225-43f4-a20d-d7e94ec8518f',
  salonB: '45a736f3-71f9-4d61-b0d4-95c78a121b66',
  barberA: '0fb2982d-044d-493f-a7cb-daebfd70bbc8',
  barberA2: '0ca832c7-0e90-4583-8ccd-44379f373313',
  barberB: '59d14e95-83fc-450c-b273-21a9e32754aa',
  serviceA: '0869aea3-2701-4403-9f3f-ed6b27fe86a7',
  serviceB: '00764a10-4ef1-4358-8d43-6df703edb93c',
}
try {
  await db.$transaction(async (tx) => {
    const salons = [
      [ids.salonA, 'e2e-playwright-salon', 'E2E Test Salon'],
      [ids.salonB, 'e2e-playwright-salon-b', 'E2E Second Salon'],
    ]
    for (const [id, slug, name] of salons) {
      await tx.salon.upsert({
        where: { id }, update: { name, slug, isActive: true },
        create: { id, slug, name, timezone: 'Asia/Tehran', isActive: true },
      })
    }
    const users = [
      ['09120000981', 'CUSTOMER', 'E2E', 'Customer', ids.salonA],
      ['09120000982', 'BARBER', 'E2E', 'Barber', ids.salonA],
      ['09120000983', 'ADMIN', 'E2E', 'AdminA', ids.salonA],
      ['09120000984', 'ADMIN', 'E2E', 'AdminB', ids.salonB],
      ['09120000985', 'BARBER', 'E2E', 'BarberTwo', ids.salonA],
      ['09120000986', 'BARBER', 'E2E', 'BarberB', ids.salonB],
      ['09120000987', 'CUSTOMER', 'E2E', 'CustomerB', ids.salonB],
      ['09120000993', 'CUSTOMER', 'E2E', 'Invited', ids.salonA],
    ]
    const userIds = {}
    for (const [phone, role, firstName, lastName, salonId] of users) {
      const u = await tx.user.upsert({
        where: { phone }, update: { role, firstName, lastName, status: 'ACTIVE' },
        create: { phone, role, firstName, lastName, status: 'ACTIVE' },
      })
      userIds[phone] = u.id
      await tx.salonMembership.upsert({
        where: { userId_salonId: { userId: u.id, salonId } },
        update: { isActive: true },
        create: { userId: u.id, salonId, isActive: true },
      })
      if (role === 'CUSTOMER') {
        await tx.customer.upsert({ where: { userId: u.id }, update: {}, create: { userId: u.id } })
      }
    }
    const barbers = [
      [ids.barberA, '09120000982', ids.salonA],
      [ids.barberA2, '09120000985', ids.salonA],
      [ids.barberB, '09120000986', ids.salonB],
    ]
    for (const [id, phone, salonId] of barbers) {
      await tx.barber.upsert({
        where: { id }, update: { salonId, isActive: true },
        create: { id, userId: userIds[phone], salonId, isActive: true },
      })
    }
    const services = [
      [ids.serviceA, ids.salonA, 'E2E Haircut', 150000],
      [ids.serviceB, ids.salonB, 'E2E Haircut B', 160000],
    ]
    for (const [id, salonId, name, price] of services) {
      await tx.service.upsert({
        where: { id }, update: { name, duration: 30, price, isActive: true },
        create: { id, salonId, name, duration: 30, price, isActive: true },
      })
    }
    const weekdays = ['SATURDAY','SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY']
    for (const [id, , salonId] of barbers) {
      const serviceId = salonId === ids.salonA ? ids.serviceA : ids.serviceB
      await tx.barberService.upsert({
        where: { barberId_serviceId: { barberId: id, serviceId } },
        update: {}, create: { barberId: id, serviceId },
      })
      for (const dayOfWeek of weekdays) {
        await tx.workingHour.upsert({
          where: { barberId_dayOfWeek: { barberId: id, dayOfWeek } },
          update: { startTime: '09:00', endTime: '22:00', isActive: true },
          create: { salonId, barberId: id, dayOfWeek, startTime: '09:00', endTime: '22:00', isActive: true },
        })
      }
    }
  })
  console.log(JSON.stringify({ seeded: true, salons: await db.salon.count(), users: await db.user.count(), barbers: await db.barber.count(), services: await db.service.count(), workingHours: await db.workingHour.count() }))
} finally {
  await db.$disconnect()
}
