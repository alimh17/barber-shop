import { IsISO8601, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class UpdateAppointmentDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  barberId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  serviceId?: string;

  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/i, {
    message: 'startAt must include a timezone (Z or ±HH:mm)',
  })
  startAt?: string;

  @IsOptional()
  @IsString()
  note?: string | null;
}
