import { RefreshOriginGuard } from './refresh-origin.guard.js';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';

describe('RefreshOriginGuard', () => {
  const guard = new RefreshOriginGuard();
  const original = process.env.CORS_ORIGINS;
  afterEach(() => { if (original === undefined) delete process.env.CORS_ORIGINS; else process.env.CORS_ORIGINS = original; });
  const ctx = (origin?: string) => ({ switchToHttp: () => ({ getRequest: () => ({ headers: origin ? { origin } : {} }) }) }) as unknown as ExecutionContext;
  it('accepts configured origin', () => { process.env.CORS_ORIGINS = 'https://staging.example.test,https://app.example.test'; expect(guard.canActivate(ctx('https://app.example.test'))).toBe(true); });
  it('rejects foreign origin', () => { process.env.CORS_ORIGINS = 'https://app.example.test'; expect(() => guard.canActivate(ctx('https://evil.example.test'))).toThrow(ForbiddenException); });
  it('rejects prefix and suffix origin tricks', () => { process.env.CORS_ORIGINS = 'https://app.example.test'; expect(() => guard.canActivate(ctx('https://app.example.test.evil.test'))).toThrow(ForbiddenException); });
  it('permits clients without Origin header', () => { expect(guard.canActivate(ctx())).toBe(true); });
});
