import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../dist/generated/prisma/client.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');
if (process.env.NODE_ENV === 'production') {
  throw new Error('Load-test seed is forbidden when NODE_ENV=production');
}

const totalUsers = Number.parseInt(process.env.LOAD_USERS ?? '1000', 10);
if (!Number.isInteger(totalUsers) || totalUsers < 100) {
  throw new Error('LOAD_USERS must be an integer of at least 100');
}

const adminCount = Math.max(2, Math.round(totalUsers * 0.02));
const barberCount = Math.max(adminCount, Math.round(totalUsers * 0.1));
const customerCount = totalUsers - adminCount - barberCount;
const pad = (value: number, width = 4) => value.toString().padStart(width, '0');
const phone = (index: number) => `09${(800_000_000 + index).toString()}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const salons = Array.from({ length: adminCount }, (_, index) => ({
  id: `load-salon-${pad(index)}`,
  name: `سالن تست بار ${pad(index + 1, 2)}`,
  slug: `loadtest-${pad(index + 1, 2)}`,
  timezone: 'Asia/Tehran',
  isActive: true,
}));
const admins = Array.from({ length: adminCount }, (_, index) => ({
  id: `load-user-admin-${pad(index)}`,
  phone: phone(index),
  firstName: 'مدیر تست',
  lastName: pad(index + 1, 2),
  role: 'ADMIN' as const,
  status: 'ACTIVE' as const,
}));
const barbers = Array.from({ length: barberCount }, (_, index) => ({
  id: `load-user-barber-${pad(index)}`,
  phone: phone(adminCount + index),
  firstName: 'آرایشگر تست',
  lastName: pad(index + 1),
  role: 'BARBER' as const,
  status: 'ACTIVE' as const,
}));
const customers = Array.from({ length: customerCount }, (_, index) => ({
  id: `load-user-customer-${pad(index)}`,
  phone: phone(adminCount + barberCount + index),
  firstName: 'مشتری تست',
  lastName: pad(index + 1),
  role: 'CUSTOMER' as const,
  status: 'ACTIVE' as const,
}));

async function main() {
  console.log(
    `Seeding ${totalUsers} load-test users into ${adminCount} salons...`,
  );
  for (const salon of salons) {
    await prisma.salon.upsert({
      where: { slug: salon.slug },
      update: { name: salon.name, timezone: salon.timezone, isActive: true },
      create: salon,
    });
  }

  await prisma.user.createMany({
    data: [...admins, ...barbers, ...customers],
    skipDuplicates: true,
  });
  await Promise.all([
    prisma.user.updateMany({
      where: { id: { startsWith: 'load-user-admin-' } },
      data: { role: 'ADMIN', status: 'ACTIVE' },
    }),
    prisma.user.updateMany({
      where: { id: { startsWith: 'load-user-barber-' } },
      data: { role: 'BARBER', status: 'ACTIVE' },
    }),
    prisma.user.updateMany({
      where: { id: { startsWith: 'load-user-customer-' } },
      data: { role: 'CUSTOMER', status: 'ACTIVE' },
    }),
  ]);

  await prisma.customer.createMany({
    data: customers.map((user) => ({
      id: `load-customer-${user.id.slice(-4)}`,
      userId: user.id,
    })),
    skipDuplicates: true,
  });
  await prisma.barber.createMany({
    data: barbers.map((user, index) => ({
      id: `load-barber-${pad(index)}`,
      userId: user.id,
      salonId: salons[index % salons.length].id,
      isActive: true,
    })),
    skipDuplicates: true,
  });
  await prisma.salonMembership.createMany({
    data: [
      ...admins.map((user, index) => ({
        id: `load-membership-admin-${pad(index)}`,
        userId: user.id,
        salonId: salons[index].id,
        isActive: true,
      })),
      ...customers.map((user, index) => ({
        id: `load-membership-customer-${pad(index)}`,
        userId: user.id,
        salonId: salons[index % salons.length].id,
        isActive: true,
      })),
    ],
    skipDuplicates: true,
  });

  const services = salons.flatMap((salon, salonIndex) =>
    Array.from({ length: 3 }, (_, serviceIndex) => ({
      id: `load-service-${pad(salonIndex)}-${serviceIndex}`,
      salonId: salon.id,
      name: ['اصلاح مو تست', 'اصلاح ریش تست', 'پاکسازی تست'][serviceIndex],
      duration: 30,
      price: 250_000 + serviceIndex * 100_000,
      isActive: true,
    })),
  );
  await prisma.service.createMany({ data: services, skipDuplicates: true });
  await prisma.barberService.createMany({
    data: barbers.flatMap((_, barberIndex) => {
      const salonIndex = barberIndex % salons.length;
      return Array.from({ length: 3 }, (_, serviceIndex) => ({
        barberId: `load-barber-${pad(barberIndex)}`,
        serviceId: `load-service-${pad(salonIndex)}-${serviceIndex}`,
      }));
    }),
    skipDuplicates: true,
  });
  const workDays = [
    'SATURDAY',
    'SUNDAY',
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
  ] as const;
  await prisma.workingHour.createMany({
    data: barbers.flatMap((_, barberIndex) => {
      const salonId = salons[barberIndex % salons.length].id;
      return workDays.map((day) => ({
        id: `load-hours-${pad(barberIndex)}-${day}`,
        salonId,
        barberId: `load-barber-${pad(barberIndex)}`,
        dayOfWeek: day,
        startTime: '09:00',
        endTime: '18:00',
        isActive: true,
      }));
    }),
    skipDuplicates: true,
  });

  const base = Date.UTC(2030, 0, 5, 5, 30);
  await prisma.appointment.createMany({
    data: customers.map((_, index) => {
      const salonIndex = index % salons.length;
      const salonBarbers = barbers
        .map((__, barberIndex) => barberIndex)
        .filter((barberIndex) => barberIndex % salons.length === salonIndex);
      const position = Math.floor(index / salons.length);
      const barberIndex = salonBarbers[position % salonBarbers.length];
      const slot = Math.floor(position / salonBarbers.length);
      const startAt = new Date(
        base + (slot % 8) * 3_600_000 + Math.floor(slot / 8) * 86_400_000,
      );
      return {
        id: `load-appointment-${pad(index)}`,
        salonId: salons[salonIndex].id,
        customerId: `load-customer-${pad(index)}`,
        barberId: `load-barber-${pad(barberIndex)}`,
        serviceId: `load-service-${pad(salonIndex)}-0`,
        startAt,
        endAt: new Date(startAt.getTime() + 30 * 60_000),
        price: 250_000,
        duration: 30,
        status: index % 5 === 0 ? ('CONFIRMED' as const) : ('PENDING' as const),
      };
    }),
    skipDuplicates: true,
  });

  // Historical completed appointments make the revenue dashboard and Excel
  // export useful in development without changing the future booking fixtures.
  await prisma.appointment.createMany({
    data: Array.from({ length: 240 }, (_, index) => {
      const salonIndex = index % salons.length;
      const salonBarbers = barbers
        .map((__, barberIndex) => barberIndex)
        .filter((barberIndex) => barberIndex % salons.length === salonIndex);
      const barberIndex = salonBarbers[index % salonBarbers.length];
      const month = index % 10;
      const day = 1 + (Math.floor(index / 10) % 24);
      const startAt = new Date(Date.UTC(2026, month, day, 6 + (index % 8), 30));
      return {
        id: `load-revenue-${pad(index)}`,
        salonId: salons[salonIndex].id,
        customerId: `load-customer-${pad(index % customers.length)}`,
        barberId: `load-barber-${pad(barberIndex)}`,
        serviceId: `load-service-${pad(salonIndex)}-0`,
        startAt,
        endAt: new Date(startAt.getTime() + 30 * 60_000),
        price: 200_000 + (index % 4) * 50_000,
        duration: 30,
        status: 'COMPLETED' as const,
      };
    }),
    skipDuplicates: true,
  });

  const [users, salonTotal, appointmentTotal, revenueAppointmentTotal] = await Promise.all([
    prisma.user.count({ where: { id: { startsWith: 'load-user-' } } }),
    prisma.salon.count({ where: { slug: { startsWith: 'loadtest-' } } }),
    prisma.appointment.count({
      where: { id: { startsWith: 'load-appointment-' } },
    }),
    prisma.appointment.count({
      where: { id: { startsWith: 'load-revenue-' } },
    }),
  ]);
  console.log(
    JSON.stringify(
      {
        users,
        salons: salonTotal,
        appointments: appointmentTotal,
        completedRevenueAppointments: revenueAppointmentTotal,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
