import {
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateBarberDto {
  @IsString()
  @IsNotEmpty()
  salonId: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;
}