import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class UpdateSalonSmsConfigDto {
  @IsString()
  @MinLength(8)
  apiKey: string;

  @IsString()
  @Matches(/^[a-zA-Z0-9_-]+$/)
  verifyTemplate: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
