import {
  CanActivate,
  ExecutionContext,
  Injectable,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service.js';
import { normalizeIranianPhone } from '../phone.util.js';

@Injectable()
export class OtpRateLimitGuard implements CanActivate {
  private readonly windowMs = 15 * 60 * 1000;
  private readonly maxPerPhone = 5;
  private readonly maxPerIp = 20;

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const rawPhone =
      typeof request.body?.phone === 'string'
        ? normalizeIranianPhone(request.body.phone)
        : 'unknown';
    const ip = request.ip || request.socket.remoteAddress || 'unknown';
    const route = request.path;

    const phoneKey = this.key(`${route}:phone:${rawPhone}`);
    const ipKey = this.key(`${route}:ip:${ip}`);

    const result = await this.prisma.$transaction(async (tx) => {
      // Expired rows are shared across instances and periodically removed.
      await tx.$executeRaw`DELETE FROM "OtpRateLimitEntry" WHERE "resetAt" <= NOW()`;

      const ipCount = await this.increment(tx, ipKey);
      if (ipCount > this.maxPerIp) return { blocked: 'ip' } as const;

      const phoneCount = await this.increment(tx, phoneKey);
      if (phoneCount > this.maxPerPhone) return { blocked: 'phone' } as const;

      return { blocked: null } as const;
    });

    if (result.blocked) {
      throw new HttpException(
        'Too many OTP requests; try again later',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private key(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private async increment(
    tx: Pick<PrismaService, '$queryRaw'>,
    key: string,
  ): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: number }>>`
      INSERT INTO "OtpRateLimitEntry" ("key", "count", "resetAt")
      VALUES (${key}, 1, NOW() + (${this.windowMs} * INTERVAL '1 millisecond'))
      ON CONFLICT ("key") DO UPDATE
      SET
        "count" = CASE
          WHEN "OtpRateLimitEntry"."resetAt" <= NOW() THEN 1
          ELSE "OtpRateLimitEntry"."count" + 1
        END,
        "resetAt" = CASE
          WHEN "OtpRateLimitEntry"."resetAt" <= NOW() THEN EXCLUDED."resetAt"
          ELSE "OtpRateLimitEntry"."resetAt"
        END
      RETURNING "count"
    `;
    return Number(rows[0]?.count ?? 0);
  }
}
