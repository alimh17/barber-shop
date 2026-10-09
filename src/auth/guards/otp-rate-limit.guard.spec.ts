import { HttpException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { OtpRateLimitGuard } from './otp-rate-limit.guard.js';

function context(phone: string, ip = '192.0.2.1', path = '/auth/request-otp') {
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

describe('OtpRateLimitGuard', () => {
  it('checks the IP limit before creating a key for another phone', () => {
    const guard = new OtpRateLimitGuard();
    for (let i = 0; i < 20; i += 1) {
      expect(
        guard.canActivate(context(`091200000${i.toString().padStart(2, '0')}`)),
      ).toBe(true);
    }

    const before = (guard as unknown as { entries: Map<string, unknown> })
      .entries.size;
    expect(() => guard.canActivate(context('09999999999'))).toThrow(
      HttpException,
    );
    const after = (guard as unknown as { entries: Map<string, unknown> })
      .entries.size;
    expect(after).toBe(before);
  });

  it('rejects new keys when the limiter reaches its memory cap', () => {
    const guard = new OtpRateLimitGuard();
    const entries = (
      guard as unknown as {
        entries: Map<string, { count: number; resetAt: number }>;
      }
    ).entries;
    const now = Date.now();
    for (let i = 0; i < 10_000; i += 1) {
      entries.set(`seed:${i}`, { count: 1, resetAt: now + 60_000 });
    }

    expect(() =>
      guard.canActivate(context('09120000000', '198.51.100.4')),
    ).toThrow(HttpException);
    expect(entries.size).toBe(10_000);
  });
});
