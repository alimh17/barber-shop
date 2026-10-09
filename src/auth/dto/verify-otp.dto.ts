import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { normalizeIranianPhone } from '../phone.util.js';

export class VerifyOtpDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeIranianPhone(value) : value,
  )
  @IsString()
  @IsNotEmpty()
  @Matches(/^09\d{9}$/, {
    message: 'phone must be a valid Iranian mobile number',
  })
  phone: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, { message: 'code must be a 6-digit OTP' })
  code: string;
}
