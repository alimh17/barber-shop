import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

class PushSubscriptionKeysDto {
  @IsString()
  @MinLength(16)
  @MaxLength(512)
  p256dh: string;

  @IsString()
  @MinLength(8)
  @MaxLength(256)
  auth: string;
}

export class SavePushSubscriptionDto {
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2_048)
  endpoint: string;

  @ValidateNested()
  @Type(() => PushSubscriptionKeysDto)
  keys: PushSubscriptionKeysDto;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  userAgent?: string;
}

export class RemovePushSubscriptionDto {
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2_048)
  endpoint: string;
}
