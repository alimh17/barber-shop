import { BadRequestException, Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service.js';
import { SmsService } from './sms.service.js';

@Injectable()
export class OtpService {
  private readonly otpExpiresInMs = 2 * 60 * 1000;
  private readonly maxAttempts = 5;

  constructor(
    private readonly prisma: PrismaService,
    private readonly smsService: SmsService,
  ) {}

  async generate(phone: string) {
    const code = this.generateCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + this.otpExpiresInMs);

    await this.prisma.$transaction(async (tx) => {
      await tx.otpCode.updateMany({
        where: { phone, usedAt: null },
        data: { usedAt: new Date() },
      });
      await tx.otpCode.create({
        data: { phone, codeHash, expiresAt },
      });
    });

    if (process.env.NODE_ENV === 'production') {
      await this.smsService.sendOtp(phone, code);
    }

    return { code, expiresAt };
  }

  async verify(phone: string, code: string): Promise<void> {
    const now = new Date();
    const otp = await this.prisma.otpCode.findFirst({
      where: { phone, usedAt: null, expiresAt: { gt: now } },
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
