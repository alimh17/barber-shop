import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { RedisService } from '../../redis/redis.service.js';
import { normalizeIranianPhone } from '../phone.util.js';

@Injectable()
export class OtpRateLimitGuard implements CanActivate {
  private readonly windowMs = 15 * 60 * 1000;
  private readonly maxPerPhone = 5;
  private readonly maxPerIp = 20;

  constructor(private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const phone =
      typeof request.body?.phone === 'string'
        ? normalizeIranianPhone(request.body.phone)
        : 'unknown';
    const ip = request.ip || request.socket.remoteAddress || 'unknown';
    const route = request.path;

    try {
      const ipCount = await this.redis.incrementWithExpiry(
        this.key(`otp:rate:${route}:ip:${ip}`),
        this.windowMs,
      );
      if (ipCount > this.maxPerIp) {
        throw new HttpException(
          'Too many OTP requests; try again later',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      const phoneCount = await this.redis.incrementWithExpiry(
        this.key(`otp:rate:${route}:phone:${phone}`),
        this.windowMs,
      );
      if (phoneCount > this.maxPerPhone) {
        throw new HttpException(
          'Too many OTP requests; try again later',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      return true;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        'OTP service temporarily unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  private key(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
