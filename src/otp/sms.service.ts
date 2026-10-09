import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SmsService {
  constructor(private readonly configService: ConfigService) {}

  async sendOtp(phone: string, code: string): Promise<void> {
    const endpoint = this.configService.get<string>('SMS_API_URL');
    const token = this.configService.get<string>('SMS_API_TOKEN');

    if (!endpoint || !token) {
      throw new ServiceUnavailableException('SMS delivery is not configured');
    }

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone,
          message: `Your verification code is ${code}`,
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new ServiceUnavailableException('SMS provider is unavailable');
    }

    if (!response.ok) {
      throw new ServiceUnavailableException('SMS delivery failed');
    }
  }
}
