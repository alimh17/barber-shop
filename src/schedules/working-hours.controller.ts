import {
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  Put,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { DayOfWeek, UserRole } from '../generated/prisma/client.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UpsertWorkingHourDto } from './dto/upsert-working-hour.dto.js';
import { WorkingHoursService } from './working-hours.service.js';

type AuthenticatedRequest = Request & {
  user: { id: string; role: UserRole };
};

@Controller('barbers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkingHoursController {
  constructor(private readonly workingHoursService: WorkingHoursService) {}

  @Get(':barberId/working-hours')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  findByBarber(
    @Param('barberId') barberId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.workingHoursService.findByBarber(
      barberId,
      req.user.id,
      req.user.role,
    );
  }

  @Put(':barberId/working-hours/:dayOfWeek')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  upsert(
    @Param('barberId') barberId: string,
    @Param('dayOfWeek', new ParseEnumPipe(DayOfWeek)) dayOfWeek: DayOfWeek,
    @Body() dto: UpsertWorkingHourDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.workingHoursService.upsert(
      barberId,
      dayOfWeek,
      dto,
      req.user.id,
      req.user.role,
    );
  }

  @Delete(':barberId/working-hours/:dayOfWeek')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  remove(
    @Param('barberId') barberId: string,
    @Param('dayOfWeek', new ParseEnumPipe(DayOfWeek)) dayOfWeek: DayOfWeek,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.workingHoursService.remove(
      barberId,
      dayOfWeek,
      req.user.id,
      req.user.role,
    );
  }
}
