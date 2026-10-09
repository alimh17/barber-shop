import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { OtpService } from './otp.service.js';
import { SmsService } from './sms.service.js';

describe('OtpService verification concurrency', () => {
  const otp = {
    id: 'otp-1',
    phone: '09120000000',
    codeHash: '',
    expiresAt: new Date(Date.now() + 60_000),
    attempts: 0,
    usedAt: null,
    createdAt: new Date(),
  };
  const prisma = { otpCode: { findFirst: vi.fn(), updateMany: vi.fn() } };
  const smsService = { sendOtp: vi.fn() };
  let service: OtpService;

  beforeEach(async () => {
    vi.resetAllMocks();
    otp.codeHash = await bcrypt.hash('123456', 4);
    service = new OtpService(
      prisma as unknown as PrismaService,
      smsService as unknown as SmsService,
    );
    prisma.otpCode.findFirst.mockResolvedValue(otp);
    prisma.otpCode.updateMany.mockResolvedValue({ count: 1 });
  });

  it('allows only one concurrent verification to consume a valid OTP', async () => {
    let consumed = false;
    prisma.otpCode.updateMany.mockImplementation(
      async (args: { data: { usedAt?: Date } }) => {
        if (args.data.usedAt) {
          if (consumed) return { count: 0 };
          consumed = true;
        }
        return { count: 1 };
      },
    );
    const results = await Promise.allSettled([
      service.verify('09120000000', '123456'),
      service.verify('09120000000', '123456'),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    expect(
      results.find((result) => result.status === 'rejected'),
    ).toMatchObject({
      status: 'rejected',
      reason: expect.any(BadRequestException),
    });
    expect(prisma.otpCode.updateMany).toHaveBeenCalledTimes(2);
    expect(prisma.otpCode.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'otp-1',
          usedAt: null,
          attempts: { lt: 5 },
        }),
        data: { usedAt: expect.any(Date) },
      }),
    );
  });
});
