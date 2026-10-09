import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { OtpService } from './otp.service.js';
import { SmsService } from './sms.service.js';

describe('OtpService generation serialization', () => {
  const queryRaw = vi.fn();
  const updateMany = vi.fn();
  const create = vi.fn();
  const transaction = vi.fn();
  const prisma = {
    $transaction: transaction,
  };
  const smsService = { sendOtp: vi.fn() };
  let service: OtpService;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('NODE_ENV', 'test');
    transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({
        $queryRaw: queryRaw,
        otpCode: { updateMany, create },
      }),
    );
    service = new OtpService(
      prisma as unknown as PrismaService,
      smsService as unknown as SmsService,
    );
  });

  it('acquires a phone-scoped PostgreSQL advisory lock before retiring and creating OTPs', async () => {
    await service.generate('09120000000');

    expect(transaction).toHaveBeenCalledOnce();
    expect(queryRaw).toHaveBeenCalledOnce();
    expect(queryRaw.mock.calls[0][0]).toEqual(
      expect.arrayContaining([
        expect.stringContaining('pg_advisory_xact_lock'),
      ]),
    );
    expect(queryRaw.mock.calls[0][1]).toBe('09120000000');
    expect(updateMany).toHaveBeenCalledBefore(create);
    expect(updateMany).toHaveBeenCalledWith({
      where: { phone: '09120000000', usedAt: null },
      data: { usedAt: expect.any(Date) },
    });
    expect(create).toHaveBeenCalledOnce();
  });
});
