import {
  CanActivate,
  ExecutionContext,
  Injectable,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';

type RateLimitEntry = { count: number; resetAt: number };

@Injectable()
export class OtpRateLimitGuard implements CanActivate {
  private readonly entries = new Map<string, RateLimitEntry>();
  private readonly windowMs = 15 * 60 * 1000;
  private readonly maxPerPhone = 5;
  private readonly maxPerIp = 20;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const phone =
      typeof request.body?.phone === 'string' ? request.body.phone : 'unknown';
    const ip = request.ip || request.socket.remoteAddress || 'unknown';
    const route = request.path;
    const now = Date.now();

    this.consume(`${route}:phone:${phone}`, this.maxPerPhone, now);
    this.consume(`${route}:ip:${ip}`, this.maxPerIp, now);

    if (this.entries.size > 10_000) {
      for (const [key, entry] of this.entries) {
        if (entry.resetAt <= now) this.entries.delete(key);
      }
    }

    return true;
  }

  private consume(key: string, limit: number, now: number): void {
    const current = this.entries.get(key);
    if (!current || current.resetAt <= now) {
      this.entries.set(key, { count: 1, resetAt: now + this.windowMs });
      return;
    }

    if (current.count >= limit) {
      throw new HttpException(
        'Too many OTP requests; try again later',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    current.count += 1;
  }
}
