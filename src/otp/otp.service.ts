import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class OtpService {
  private readonly otpExpiresInMs = 2 * 60 * 1000;
  private readonly maxAttempts = 5;

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async generate(phone: string) {
    const code = this.generateCode();
    const codeHash = await bcrypt.hash(code, 10);

    const expiresAt = new Date(
      Date.now() + this.otpExpiresInMs,
    );

    await this.prisma.otpCode.updateMany({
      where: {
        phone,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });

    await this.prisma.otpCode.create({
      data: {
        phone,
        codeHash,
        expiresAt,
      },
    });

    return {
      code,
      expiresAt,
    };
  }

  async verify(phone: string, code: string): Promise<void> {
    const otp = await this.prisma.otpCode.findFirst({
      where: {
        phone,
        usedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!otp) {
      throw new BadRequestException(
        'OTP not found',
      );
    }

    if (otp.expiresAt < new Date()) {
      throw new BadRequestException(
        'OTP has expired',
      );
    }

    if (otp.attempts >= this.maxAttempts) {
      throw new BadRequestException(
        'Too many attempts',
      );
    }

    const isValid = await bcrypt.compare(
      code,
      otp.codeHash,
    );

    if (!isValid) {
      await this.prisma.otpCode.update({
        where: {
          id: otp.id,
        },
        data: {
          attempts: {
            increment: 1,
          },
        },
      });

      throw new BadRequestException(
        'Invalid OTP',
      );
    }

    await this.prisma.otpCode.update({
      where: {
        id: otp.id,
      },
      data: {
        usedAt: new Date(),
      },
    });
  }

  private generateCode(): string {
    return Math.floor(
      100000 + Math.random() * 900000,
    ).toString();
  }
}