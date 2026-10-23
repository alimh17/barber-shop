import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateUserDto {
  /** User's first name. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  /** User's last name. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;
}
