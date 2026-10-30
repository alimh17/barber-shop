import { describe, expect, it } from 'vitest';
import { validateEnvironment } from './environment.js';

describe('environment validation', () => {
  it('defaults local development to the mock SMS provider', () => {
    expect(validateEnvironment({ NODE_ENV: 'development' })).toMatchObject({
      NODE_ENV: 'development',
      SMS_PROVIDER: 'mock',
    });
  });

  it.each(['production', 'staging'])('rejects mock in %s', (nodeEnv) => {
    expect(() =>
      validateEnvironment({ NODE_ENV: nodeEnv, SMS_PROVIDER: 'mock' }),
    ).toThrow(/only in development or test/i);
  });

  it('requires a complete Kavenegar configuration', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'production',
        SMS_PROVIDER: 'kavenegar',
      }),
    ).toThrow(/KAVENEGAR_API_KEY/);
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'production',
        SMS_PROVIDER: 'kavenegar',
        KAVENEGAR_API_KEY: 'secret',
        KAVENEGAR_VERIFY_TEMPLATE: 'invalid template',
      }),
    ).toThrow(/KAVENEGAR_VERIFY_TEMPLATE/);
  });

  it('accepts a complete production Kavenegar configuration', () => {
    expect(
      validateEnvironment({
        NODE_ENV: 'production',
        SMS_PROVIDER: 'kavenegar',
        KAVENEGAR_API_KEY: 'secret',
        KAVENEGAR_VERIFY_TEMPLATE: 'login_verify',
        SMS_CREDENTIALS_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
      }),
    ).toMatchObject({
      SMS_PROVIDER: 'kavenegar',
      KAVENEGAR_API_KEY: 'secret',
      KAVENEGAR_VERIFY_TEMPLATE: 'login_verify',
    });
  });

  it('rejects partial or invalid Web Push configuration', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'development',
        VAPID_PUBLIC_KEY: 'public-key',
      }),
    ).toThrow(/configured together/i);
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'development',
        VAPID_SUBJECT: 'admin@example.com',
        VAPID_PUBLIC_KEY: 'public-key',
        VAPID_PRIVATE_KEY: 'private-key',
      }),
    ).toThrow(/VAPID_SUBJECT/);
  });
});
