import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRole, UserStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from './users.service.js';

describe('UsersService administration', () => {
  const prisma = {
    user: { findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  };
  let service: UsersService;

  beforeEach(() => { vi.resetAllMocks(); service = new UsersService(prisma as unknown as PrismaService); });

  it('returns paginated users without exposing sensitive fields', async () => {
    prisma.$transaction.mockResolvedValue([[{ id: 'u1' }], 21]);
    await expect(service.findAll('root', UserRole.SUPER_ADMIN, { page: 2, limit: 10 })).resolves.toEqual({
      items: [{ id: 'u1' }], meta: { page: 2, limit: 10, total: 21, totalPages: 3 },
    });
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10, select: expect.not.objectContaining({ refreshTokenHash: true }) }));
  });

  it('scopes administrators to actively managed salons', async () => {
    prisma.$transaction.mockResolvedValue([[], 0]);
    await service.findAll('admin-1', UserRole.ADMIN, { page: 1, limit: 20, salonId: 'salon-1' });
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ AND: expect.arrayContaining([expect.objectContaining({ OR: expect.any(Array) })]) }),
    }));
  });

  it('prevents customers from reading another profile', async () => {
    await expect(service.findOne('other', 'customer', UserRole.CUSTOMER)).rejects.toThrow(ForbiddenException);
  });

  it('throws when a visible user does not exist', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.findOne('missing', 'root', UserRole.SUPER_ADMIN)).rejects.toThrow(NotFoundException);
  });

  it('updates a profile after authorization', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'self' });
    prisma.user.update.mockResolvedValue({ id: 'self', firstName: 'Ali' });
    await expect(service.update('self', { firstName: 'Ali' }, 'self', UserRole.CUSTOMER)).resolves.toMatchObject({ firstName: 'Ali' });
  });

  it('prevents a super administrator from disabling their own account', async () => {
    await expect(service.updateStatus('root', UserStatus.BLOCKED, 'root')).rejects.toThrow(ForbiddenException);
  });

  it('changes another user status', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    prisma.user.update.mockResolvedValue({ id: 'u1', status: UserStatus.BLOCKED });
    await expect(service.updateStatus('u1', UserStatus.BLOCKED, 'root')).resolves.toMatchObject({ status: UserStatus.BLOCKED });
  });
});
