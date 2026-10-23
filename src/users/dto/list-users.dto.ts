import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

import { UserRole, UserStatus } from '../../generated/prisma/client.js';

export class ListUsersDto {
  /** Page number, starting at 1. */
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page = 1;

  /** Number of users per page (maximum 100). */
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  /** Filter by user role. */
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  /** Filter by account status. */
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  /** Partial phone, first-name, or last-name search. */
  @IsOptional()
  @IsString()
  search?: string;

  /** Limit results to one salon. Required for neither super admins nor regular admins. */
  @IsOptional()
  @IsUUID()
  salonId?: string;
}
