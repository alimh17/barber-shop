import { HttpException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OtpRateLimitGuard } from './otp-rate-limit.guard.js';

function context(phone: string, ip = '192.0.2.1', path = '/api/auth/request-otp') {
  const request = {
    body: { phone },
    ip,
    path,
    socket: { remoteAddress: ip },
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function setup() {
  const counts = new Map<string, number>();
  const tx = {
    $executeRaw: vi.fn(async () => 0),
    $queryRaw: vi.fn(async (_strings: TemplateStringsArray, key: string) => {
      const count = (counts.get(key) ?? 0) + 1;
      counts.set(key, count);
      return [{ count }];
    }),
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  return {
    guard: new OtpRateLimitGuard(prisma as never),
    tx,
    prisma,
    counts,
  };
}

describe('OtpRateLimitGuard', () => {
  it('uses the same phone key for local and international Iranian formats', async () => {
    const { guard, counts } = setup();
    await guard.canActivate(context('09123456789'));
    await guard.canActivate(context('+989123456789'));
    expect(counts.size).toBe(2);
    expect([...counts.values()]).toEqual([2, 2]);
  });

  it('enforces the IP limit before incrementing a new phone key', async () => {
    const { guard, counts } = setup();
    for (let i = 0; i < 20; i += 1) {
      await guard.canActivate(
        context(`09${String(i).padStart(9, '0')}`, '192.0.2.1'),
      );
    }

    const before = counts.size;
    await expect(
      guard.canActivate(context('09123456789', '192.0.2.1')),
    ).rejects.toThrow(HttpException);
    expect(counts.size).toBe(before);
  });

  it('shares counters through the database transaction and blocks after five phone requests', async () => {
    const { guard } = setup();
    for (let i = 0; i < 5; i += 1) {
      await guard.canActivate(context('09123456789', `192.0.2.${i + 1}`));
    }
    await expect(
      guard.canActivate(context('09123456789', '192.0.2.99')),
    ).rejects.toThrow(HttpException);
  });
});
