import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  Put,
  UseGuards,
} from '@nestjs/common';

import {
  DayOfWeek,
  UserRole,
} from '../generated/prisma/client.js';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

import { UpsertWorkingHourDto } from './dto/upsert-working-hour.dto.js';
import { WorkingHoursService } from './working-hours.service.js';

@Controller('barbers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkingHoursController {
  constructor(
    private readonly workingHoursService: WorkingHoursService,
  ) {}

  @Get(':barberId/working-hours')
  @Roles(
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
  )
  findByBarber(
    @Param('barberId') barberId: string,
  ) {
    return this.workingHoursService.findByBarber(
      barberId,
    );
  }

  @Put(':barberId/working-hours/:dayOfWeek')
  @Roles(
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
  )
  upsert(
    @Param('barberId') barberId: string,
    @Param(
      'dayOfWeek',
      new ParseEnumPipe(DayOfWeek),
    )
    dayOfWeek: DayOfWeek,
    @Body() dto: UpsertWorkingHourDto,
  ) {
    return this.workingHoursService.upsert(
      barberId,
      dayOfWeek,
      dto,
    );
  }

  @Delete(':barberId/working-hours/:dayOfWeek')
  @Roles(
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
  )
  remove(
    @Param('barberId') barberId: string,
    @Param(
      'dayOfWeek',
      new ParseEnumPipe(DayOfWeek),
    )
    dayOfWeek: DayOfWeek,
  ) {
    return this.workingHoursService.remove(
      barberId,
      dayOfWeek,
    );
  }
}