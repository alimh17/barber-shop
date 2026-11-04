import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class RefreshOriginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const origin = req.headers.origin;
    if (!origin) return true; // Non-browser clients may omit Origin; SameSite cookie remains browser protection.
    const allowed = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
      .split(',').map(value => value.trim()).filter(Boolean);
    if (!allowed.includes(origin)) throw new ForbiddenException('Untrusted request origin');
    return true;
  }
}
