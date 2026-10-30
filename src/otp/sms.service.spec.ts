import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { SmsService } from './sms.service.js';
import { encryptSmsSecret } from './sms-credentials.crypto.js';

describe('SmsService providers', () => {
  const values: Record<string, string | undefined> = {};
  const config = {
    get: (key: string) => values[key],
    getOrThrow: (key: string) => {
      const value = values[key];
      if (!value) throw new Error(`${key} is required`);
      return value;
    },
  } as ConfigService;
  const prisma = { salon: { findFirst: vi.fn() } };
  const service = new SmsService(config, prisma as never);
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    Object.keys(values).forEach((key) => delete values[key]);
    vi.restoreAllMocks();
    prisma.salon.findFirst.mockReset();
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('uses mock without network access', async () => {
    values.SMS_PROVIDER = 'mock';
    values.NODE_ENV = 'development';
    globalThis.fetch = vi.fn();
    const delivery = await service.prepareDelivery();
    await service.sendOtp('09120000000', '123456', delivery);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('scopes mock OTP delivery to the selected salon', async () => {
    values.SMS_PROVIDER = 'mock';
    values.NODE_ENV = 'development';
    prisma.salon.findFirst.mockResolvedValueOnce({ id: 'salon-1' });
    await expect(service.prepareDelivery('loadtest-01')).resolves.toEqual({
      salonId: 'salon-1',
      provider: 'mock',
    });
  });

  it('rejects mock in production and missing provider', async () => {
    values.SMS_PROVIDER = 'mock';
    values.NODE_ENV = 'production';
    await expect(service.prepareDelivery()).rejects.toThrow();
    values.NODE_ENV = 'staging';
    await expect(service.prepareDelivery()).rejects.toThrow();
    values.SMS_PROVIDER = undefined;
    await expect(service.prepareDelivery()).rejects.toThrow();
  });

  it('rejects missing Kavenegar credentials', async () => {
    values.SMS_PROVIDER = 'kavenegar';
    await expect(service.prepareDelivery()).rejects.toThrow();
  });

  it('sends a verify lookup request and accepts provider success', async () => {
    values.SMS_PROVIDER = 'kavenegar';
    values.KAVENEGAR_API_KEY = 'test-key';
    values.KAVENEGAR_VERIFY_TEMPLATE = 'verify';
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ return: { status: 200 } }),
    });
    const delivery = await service.prepareDelivery();
    await service.sendOtp('09120000000', '123456', delivery);
    expect(globalThis.fetch).toHaveBeenCalledOnce();
    const [url, options] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(typeof url).toBe('string');
    expect(typeof options?.body).toBe('string');
    if (typeof url !== 'string' || typeof options?.body !== 'string') {
      throw new Error('Expected string URL and form-encoded request body');
    }
    expect(url).toContain('/verify/lookup.json');
    expect(new URLSearchParams(options.body).get('token')).toBe('123456');
    expect(new URLSearchParams(options.body).get('template')).toBe('verify');
  });

  it('uses the selected salon credentials instead of the platform account', async () => {
    values.SMS_PROVIDER = 'kavenegar';
    values.KAVENEGAR_API_KEY = 'platform-key';
    values.KAVENEGAR_VERIFY_TEMPLATE = 'platform-template';
    values.SMS_CREDENTIALS_ENCRYPTION_KEY = Buffer.alloc(32, 2).toString(
      'base64',
    );
    const secret = encryptSmsSecret(
      'tenant-key',
      values.SMS_CREDENTIALS_ENCRYPTION_KEY,
    );
    prisma.salon.findFirst.mockResolvedValueOnce({
      id: 'salon-1',
      smsConfig: {
        isActive: true,
        encryptedApiKey: secret.encrypted,
        apiKeyIv: secret.iv,
        apiKeyAuthTag: secret.authTag,
        verifyTemplate: 'tenant-template',
      },
    });

    await expect(service.prepareDelivery('tenant-salon')).resolves.toEqual({
      salonId: 'salon-1',
      provider: 'kavenegar',
      apiKey: 'tenant-key',
      template: 'tenant-template',
    });
  });

  it('allows the platform account only for an authorized initial admin login', async () => {
    values.SMS_PROVIDER = 'kavenegar';
    values.KAVENEGAR_API_KEY = 'platform-key';
    values.KAVENEGAR_VERIFY_TEMPLATE = 'platform-template';
    prisma.salon.findFirst.mockResolvedValueOnce({
      id: 'salon-1',
      smsConfig: null,
    });

    await expect(
      service.prepareDelivery('tenant-salon', true),
    ).resolves.toEqual({
      salonId: 'salon-1',
      provider: 'kavenegar',
      apiKey: 'platform-key',
      template: 'platform-template',
    });
  });

  it('rejects HTTP failure, provider rejection and network errors', async () => {
    values.SMS_PROVIDER = 'kavenegar';
    values.KAVENEGAR_API_KEY = 'test-key';
    values.KAVENEGAR_VERIFY_TEMPLATE = 'verify';
    for (const response of [
      { ok: false },
      { ok: true, json: async () => ({ return: { status: 400 } }) },
    ]) {
      globalThis.fetch = vi.fn().mockResolvedValue(response);
      const delivery = await service.prepareDelivery();
      await expect(
        service.sendOtp('09120000000', '123456', delivery),
      ).rejects.toThrow();
    }
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('timeout'));
    const delivery = await service.prepareDelivery();
    await expect(
      service.sendOtp('09120000000', '123456', delivery),
    ).rejects.toThrow();
  });
});
