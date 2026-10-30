import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { decryptSmsSecret } from './sms-credentials.crypto.js';

export type SmsProvider = 'mock' | 'kavenegar';
export type SmsDelivery =
  | { salonId: string | null; provider: 'mock' }
  | {
      salonId: string | null;
      provider: 'kavenegar';
      apiKey: string;
      template: string;
    };

@Injectable()
export class SmsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async prepareDelivery(
    salonSlug?: string,
    allowPlatformBootstrap = false,
  ): Promise<SmsDelivery> {
    const provider = this.configService.get<string>('SMS_PROVIDER')?.trim();
    if (provider === 'mock') {
      const nodeEnv = this.configService.get<string>('NODE_ENV');
      if (nodeEnv !== 'development' && nodeEnv !== 'test') {
        throw new ServiceUnavailableException(
          'Mock SMS is allowed only in development or test',
        );
      }
      const salon = salonSlug
        ? await this.prisma.salon.findFirst({
            where: { slug: salonSlug, isActive: true },
            select: { id: true },
          })
        : null;
      if (salonSlug && !salon) {
        throw new ServiceUnavailableException('Salon is unavailable');
      }
      // Never log the code, including in mock mode.
      return { salonId: salon?.id ?? null, provider: 'mock' };
    }

    let salonId: string | null = null;
    if (salonSlug) {
      const salon = await this.prisma.salon.findFirst({
        where: { slug: salonSlug, isActive: true },
        select: { id: true, smsConfig: true },
      });
      if (!salon) throw new ServiceUnavailableException('Salon is unavailable');
      salonId = salon.id;
      if (!salon.smsConfig?.isActive && !allowPlatformBootstrap) {
        throw new ServiceUnavailableException('Salon SMS is not configured');
      }
      if (salon.smsConfig?.isActive) {
        const key = this.configService.getOrThrow<string>(
          'SMS_CREDENTIALS_ENCRYPTION_KEY',
        );
        return {
          salonId,
          provider: 'kavenegar',
          apiKey: decryptSmsSecret(
            {
              encrypted: salon.smsConfig.encryptedApiKey,
              iv: salon.smsConfig.apiKeyIv,
              authTag: salon.smsConfig.apiKeyAuthTag,
            },
            key,
          ),
          template: salon.smsConfig.verifyTemplate,
        };
      }
    }

    if (provider !== 'kavenegar') {
      throw new ServiceUnavailableException('SMS provider is not configured');
    }

    const apiKey = this.configService.get<string>('KAVENEGAR_API_KEY')?.trim();
    const template = this.configService
      .get<string>('KAVENEGAR_VERIFY_TEMPLATE')
      ?.trim();
    if (!apiKey || !template || !/^[a-zA-Z0-9_-]+$/.test(template)) {
      throw new ServiceUnavailableException('Kavenegar SMS is not configured');
    }
    return { salonId, provider: 'kavenegar', apiKey, template };
  }

  async sendOtp(
    phone: string,
    code: string,
    delivery: SmsDelivery,
  ): Promise<void> {
    if (delivery.provider === 'mock') return;

    const endpoint = `https://api.kavenegar.com/v1/${encodeURIComponent(delivery.apiKey)}/verify/lookup.json`;
    const body = new URLSearchParams({
      receptor: phone,
      token: code,
      template: delivery.template,
    });
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new ServiceUnavailableException('SMS provider is unavailable');
    }
    if (!response.ok) {
      throw new ServiceUnavailableException('SMS delivery failed');
    }
    try {
      const result = (await response.json()) as {
        return?: { status?: number };
      };
      if (result.return?.status !== 200) {
        throw new ServiceUnavailableException('SMS delivery failed');
      }
    } catch {
      throw new ServiceUnavailableException('SMS delivery failed');
    }
  }
}
