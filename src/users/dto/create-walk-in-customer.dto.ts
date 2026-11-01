import { IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizeIranianPhone } from '../../auth/phone.util.js';

export class CreateWalkInCustomerDto {
  @IsUUID()
  salonId: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @Transform(({ value }) => typeof value === 'string' && value.trim() ? normalizeIranianPhone(value) : undefined)
  @ValidateIf((dto: CreateWalkInCustomerDto) => !dto.name?.trim() || dto.phone !== undefined)
  @IsString()
  @Matches(/^09\d{9}$/)
  phone?: string;
}
