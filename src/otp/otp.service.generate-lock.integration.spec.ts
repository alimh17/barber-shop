import 'dotenv/config';

import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { OtpService } from './otp.service.js';
import type { SmsService } from './sms.service.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not configured for OTP generation integration tests',
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});
const smsService = { sendOtp: async () => undefined } as SmsService;
const service = new OtpService(prisma as unknown as PrismaService, smsService);
const testPhones: string[] = [];

describe('OTP generation PostgreSQL concurrency integration', () => {
  afterEach(async () => {
    if (testPhones.length > 0) {
      await prisma.otpCode.deleteMany({
        where: { phone: { in: [...testPhones] } },
      });
      testPhones.length = 0;
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('leaves only one active OTP when two generation requests race for the same phone', async () => {
    const phone = `integration-${randomUUID()}`;
    testPhones.push(phone);

    await Promise.all([service.generate(phone), service.generate(phone)]);

    const records = await prisma.otpCode.findMany({
      where: { phone },
      orderBy: { createdAt: 'asc' },
    });
    expect(records).toHaveLength(2);
    expect(records.filter((record) => record.usedAt === null)).toHaveLength(1);
    expect(records.filter((record) => record.usedAt !== null)).toHaveLength(1);
  });
});
