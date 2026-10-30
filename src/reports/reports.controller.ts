import {
  Controller,
  Get,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { CurrentUserData } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { UserRole } from '../generated/prisma/client.js';
import {
  RevenuePeriodQueryDto,
  RevenueReportQueryDto,
} from './dto/revenue-report-query.dto.js';
import { ReportsService } from './reports.service.js';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('my-revenue')
  @Roles(UserRole.BARBER)
  @ApiOperation({ summary: 'Get authenticated barber revenue trend' })
  myRevenue(@CurrentUser() user: CurrentUserData, @Query('period') period?: string) {
    return this.reportsService.getMyRevenue(user.id, period);
  }

  @Get('revenue/export')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Export completed appointment revenue as Excel' })
  async exportRevenue(
    @CurrentUser() user: CurrentUserData,
    @Query() query: RevenuePeriodQueryDto,
  ) {
    const report = await this.reportsService.exportRevenueReport(
      query,
      user.id,
      user.role,
    );
    return new StreamableFile(report.buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="${report.filename}"`,
      length: report.buffer.length,
    });
  }

  @Get('revenue')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get monthly or annual completed appointment revenue',
  })
  getRevenue(
    @CurrentUser() user: CurrentUserData,
    @Query() query: RevenueReportQueryDto,
  ) {
    return this.reportsService.getRevenueReport(query, user.id, user.role);
  }
}
