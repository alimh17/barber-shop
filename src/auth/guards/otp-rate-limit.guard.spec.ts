import { HttpException, HttpStatus } from '@nestjs/common';
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
  const incrementWithExpiry = vi.fn(async (key: string) => {
    const count = (counts.get(key) ?? 0) + 1;
    counts.set(key, count);
    return count;
  });
  return {
    guard: new OtpRateLimitGuard({ incrementWithExpiry } as never),
    counts,
    incrementWithExpiry,
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
    ).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
    expect(counts.size).toBe(before);
  });

  it('blocks after five requests for one phone across different IPs', async () => {
    const { guard } = setup();
    for (let i = 0; i < 5; i += 1) {
      await guard.canActivate(context('09123456789', `192.0.2.${i + 1}`));
    }
    await expect(
      guard.canActivate(context('09123456789', '192.0.2.99')),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('fails closed if Redis is unavailable', async () => {
    const guard = new OtpRateLimitGuard({
      incrementWithExpiry: vi.fn().mockRejectedValue(new Error('offline')),
    } as never);
    await expect(guard.canActivate(context('09123456789'))).rejects.toMatchObject({
      status: HttpStatus.SERVICE_UNAVAILABLE,
    });
  });
});
