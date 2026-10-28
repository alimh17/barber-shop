import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../dist/generated/prisma/client.js'

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })
try {
  const [unassigned, duplicates, appointments, barberMismatch, memberships] = await Promise.all([
    db.user.findMany({ where: { role: 'CUSTOMER', salonMemberships: { none: { isActive: true } } }, select: { id: true, phone: true } }),
    db.salonMembership.groupBy({ by: ['userId'], where: { isActive: true }, _count: { _all: true }, having: { userId: { _count: { gt: 1 } } } }),
    db.appointment.findMany({ select: { id: true, status: true, salonId: true, customer: { select: { userId: true } } } }),
    db.barber.findMany({ where: { isActive: true }, select: { id: true, salonId: true, userId: true } }),
    db.salonMembership.findMany({ where: { isActive: true }, select: { userId: true, salonId: true } }),
  ])
  const activeByUser = new Map()
  for (const m of memberships) {
    const salons = activeByUser.get(m.userId) ?? new Set()
    salons.add(m.salonId)
    activeByUser.set(m.userId, salons)
  }
  const foreignAppointments = appointments.filter(a => a.status !== 'CANCELLED' && !activeByUser.get(a.customer.userId)?.has(a.salonId)).map(a => a.id)
  const cancelledHistoricalForeignAppointments = appointments.filter(a => a.status === 'CANCELLED' && !activeByUser.get(a.customer.userId)?.has(a.salonId)).length
  const barberMembershipMismatch = barberMismatch.filter(b => activeByUser.has(b.userId) && !activeByUser.get(b.userId).has(b.salonId)).map(b => b.id)
  const report = {
    unassignedCustomerCount: unassigned.length,
    unassignedCustomerIds: unassigned.map(u => u.id),
    duplicateActiveMembershipUsers: duplicates.map(d => d.userId),
    activeAppointmentsWithoutMatchingActiveMembership: foreignAppointments,
    cancelledHistoricalForeignAppointments,
    barbersWithForeignActiveMembership: barberMembershipMismatch,
    needsManualReview: unassigned.length + duplicates.length + foreignAppointments.length + barberMembershipMismatch.length > 0,
  }
  console.log(JSON.stringify(report, null, 2))
  if (report.needsManualReview) process.exitCode = 2
} finally {
  await db.$disconnect()
}
