import { Type } from 'class-transformer';
import { IsInt, IsString, Matches, Max, Min, MinLength } from 'class-validator';

export class RevenuePeriodQueryDto {
  @IsString()
  @MinLength(1)
  salonId: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to: string;
}

export class RevenueReportQueryDto extends RevenuePeriodQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 25;
}
