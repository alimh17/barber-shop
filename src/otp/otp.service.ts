import { BadRequestException, Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service.js';
import { SmsService } from './sms.service.js';
import { normalizeIranianPhone } from '../auth/phone.util.js';

@Injectable()
export class OtpService {
  private readonly otpExpiresInMs = 2 * 60 * 1000;
  private readonly maxAttempts = 5;

  constructor(
    private readonly prisma: PrismaService,
    private readonly smsService: SmsService,
  ) {}

  async generate(
    phone: string,
    salonSlug?: string,
    allowPlatformBootstrap = false,
  ) {
    phone = normalizeIranianPhone(phone);
    const delivery = await this.smsService.prepareDelivery(
      salonSlug,
      allowPlatformBootstrap,
    );
    const code = this.generateCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + this.otpExpiresInMs);

    const otp = await this.prisma.$transaction(async (tx) => {
      // Serialize OTP generation per phone across application instances.
      // PostgreSQL releases this transaction-scoped advisory lock on commit/rollback.
      const lockKey = `${delivery.salonId ?? 'platform'}:${phone}`;
      await tx.$queryRaw`SELECT 1 WHERE pg_advisory_xact_lock(hashtextextended(${lockKey}, 0)) IS NULL`;
      await tx.otpCode.updateMany({
        where: { phone, salonId: delivery.salonId, usedAt: null },
        data: { usedAt: new Date() },
      });
      return tx.otpCode.create({
        data: { phone, salonId: delivery.salonId, codeHash, expiresAt },
        select: { id: true },
      });
    });

    // Delivery mode is selected explicitly by SMS_PROVIDER, not NODE_ENV.
    try {
      await this.smsService.sendOtp(phone, code, delivery);
    } catch (error) {
      // A code that was not delivered must never remain valid. The rate-limit
      // attempt is intentionally retained to prevent provider-failure abuse.
      await this.prisma.otpCode.updateMany({
        where: { id: otp.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      throw error;
    }

    return { code, expiresAt };
  }

  async verify(phone: string, code: string, salonSlug?: string): Promise<void> {
    phone = normalizeIranianPhone(phone);
    const salon = salonSlug
      ? await this.prisma.salon.findFirst({
          where: { slug: salonSlug, isActive: true },
          select: { id: true },
        })
      : null;
    if (salonSlug && !salon) throw new BadRequestException('Salon not found');
    const now = new Date();
    const otp = await this.prisma.otpCode.findFirst({
      where: {
        phone,
        salonId: salon?.id ?? null,
        usedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      throw new BadRequestException('OTP not found or expired');
    }

    if (otp.attempts >= this.maxAttempts) {
      throw new BadRequestException('Too many attempts');
    }

    const isValid = await bcrypt.compare(code, otp.codeHash);

    if (!isValid) {
      const attempt = await this.prisma.otpCode.updateMany({
        where: {
          id: otp.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
          attempts: { lt: this.maxAttempts },
        },
        data: { attempts: { increment: 1 } },
      });

      if (attempt.count === 0) {
        throw new BadRequestException('OTP is no longer valid');
      }

      throw new BadRequestException('Invalid OTP');
    }

    // Conditional update makes consumption atomic: only one concurrent verifier wins.
    const consumed = await this.prisma.otpCode.updateMany({
      where: {
        id: otp.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
        attempts: { lt: this.maxAttempts },
      },
      data: { usedAt: new Date() },
    });

    if (consumed.count !== 1) {
      throw new BadRequestException('OTP is no longer valid');
    }
  }

  private generateCode(): string {
    return randomInt(100_000, 1_000_000).toString();
  }
}
