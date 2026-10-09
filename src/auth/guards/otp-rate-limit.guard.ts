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
  private readonly maxEntries = 10_000;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const phone =
      typeof request.body?.phone === 'string'
        ? request.body.phone.trim()
        : 'unknown';
    const ip = request.ip || request.socket.remoteAddress || 'unknown';
    const route = request.path;
    const now = Date.now();

    // Enforce the IP limit first so a blocked IP cannot create arbitrary
    // per-phone keys by sending requests with different phone values.
    this.consume(`${route}:ip:${ip}`, this.maxPerIp, now);
    this.consume(`${route}:phone:${phone}`, this.maxPerPhone, now);

    return true;
  }

  private consume(key: string, limit: number, now: number): void {
    const current = this.entries.get(key);
    if (current && current.resetAt > now) {
      if (current.count >= limit) {
        throw new HttpException(
          'Too many OTP requests; try again later',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      current.count += 1;
      return;
    }

    this.pruneExpired(now);

    // Bound memory even when requests arrive from many unique IPs/phones.
    if (this.entries.size >= this.maxEntries) {
      throw new HttpException(
        'OTP rate limiter is at capacity; try again later',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.entries.set(key, { count: 1, resetAt: now + this.windowMs });
  }

  private pruneExpired(now: number): void {
    if (this.entries.size < this.maxEntries) return;
    for (const [key, entry] of this.entries) {
      if (entry.resetAt <= now) this.entries.delete(key);
      if (this.entries.size < this.maxEntries) return;
    }
  }
}
