import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class GetAvailabilityDto {
  @IsString()
  @IsNotEmpty()
  salonId: string;

  @IsString()
  @IsNotEmpty()
  barberId: string;

  @IsString()
  @IsNotEmpty()
  serviceId: string;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(120)
  slotIntervalMinutes?: number;
}