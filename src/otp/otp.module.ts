import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { OtpService } from './otp.service.js';
import { SmsService } from './sms.service.js';

@Module({
  imports: [ConfigModule],
  providers: [OtpService, SmsService],
  exports: [OtpService],
})
export class OtpModule {}
