import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException, ConflictException } from '@nestjs/common';
import { UserRole, UserStatus } from '../generated/prisma/client.js';
import { UsersService } from './users.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

function setup() {
  const prisma = {
    barber: { findFirst: vi.fn() },
    salonMembership: { findFirst: vi.fn() },
    salon: { findFirst: vi.fn().mockResolvedValue({ id: 'salon-1' }) },
    user: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: 'user-1', customer: { id: 'customer-1' } }), update: vi.fn() },
  };
  return { prisma, service: new UsersService(prisma as unknown as PrismaService) };
}
describe('manual salon customer registration', () => {
  it('allows a salon admin to create a name-only customer without fake phone', async () => {
    const { prisma, service } = setup();
    prisma.salonMembership.findFirst.mockResolvedValue({ id: 'membership-1' });
    await service.createWalkInCustomer('admin-1', UserRole.ADMIN, { salonId: 'salon-1', name: 'Walk in' });
    expect(prisma.user.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ phone: null, firstName: 'Walk in', customer: { create: {} } }) }));
  });
  it('rejects a barber without salon access', async () => {
    const { prisma, service } = setup();
    prisma.barber.findFirst.mockResolvedValue(null);
    await expect(service.createWalkInCustomer('barber-1', UserRole.BARBER, { salonId: 'other-salon', name: 'Walk in' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
  it('does not reuse a phone from another salon', async () => {
    const { prisma, service } = setup();
    prisma.salonMembership.findFirst.mockResolvedValue({ id: 'membership-1' });
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', role: UserRole.CUSTOMER, status: UserStatus.ACTIVE, salonMemberships: [{ salonId: 'other-salon' }] });
    await expect(service.createWalkInCustomer('admin-1', UserRole.ADMIN, { salonId: 'salon-1', phone: '09123456789' })).rejects.toBeInstanceOf(ConflictException);
  });
});
