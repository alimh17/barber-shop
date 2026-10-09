import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OtpService } from '../otp/otp.service.js';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';

describe('AuthService OTP exposure', () => {
  const users = {} as UsersService;
  const otp = { generate: vi.fn() };
  const jwt = {} as JwtService;
  const configValues: Record<string, string | undefined> = {};
  const config = {
    get: (key: string) => configValues[key],
  };
  let service: AuthService;

  beforeEach(() => {
    vi.resetAllMocks();
    for (const key of Object.keys(configValues)) delete configValues[key];
    otp.generate.mockResolvedValue({
      code: '123456',
      expiresAt: new Date('2026-10-09T00:00:00.000Z'),
    });
    service = new AuthService(
      users,
      otp as unknown as OtpService,
      jwt,
      config as unknown as ConfigService,
    );
  });

  it('does not expose the OTP by default, including when NODE_ENV is unset', async () => {
    const result = await service.requestOtp({ phone: '09120000000' });
    expect(result).not.toHaveProperty('otp');
  });

  it('does not expose the OTP in staging or production', async () => {
    configValues.NODE_ENV = 'staging';
    configValues.OTP_EXPOSE_CODE = 'true';
    expect(
      await service.requestOtp({ phone: '09120000000' }),
    ).not.toHaveProperty('otp');

    configValues.NODE_ENV = 'production';
    expect(
      await service.requestOtp({ phone: '09120000000' }),
    ).not.toHaveProperty('otp');
  });

  it('exposes the OTP only when explicitly enabled in development', async () => {
    configValues.NODE_ENV = 'development';
    configValues.OTP_EXPOSE_CODE = 'true';
    await expect(
      service.requestOtp({ phone: '09120000000' }),
    ).resolves.toMatchObject({
      otp: '123456',
    });
  });
});
