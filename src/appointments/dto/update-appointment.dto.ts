import { IsISO8601, IsNotEmpty, IsOptional, IsString } from 'class-validator';

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
  @IsISO8601()
  startAt?: string;

  @IsOptional()
  @IsString()
  note?: string | null;
}
