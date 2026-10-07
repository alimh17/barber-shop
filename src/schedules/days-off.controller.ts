import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import { UserRole } from '../generated/prisma/client.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

import { CreateDayOffDto } from './dto/create-day-off.dto.js';
import { DaysOffService } from './days-off.service.js';

@Controller('barbers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DaysOffController {
  constructor(
    private readonly daysOffService: DaysOffService,
  ) {}

  @Post(':barberId/days-off')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  create(
    @Param('barberId') barberId: string,
    @Body() dto: CreateDayOffDto,
  ) {
    return this.daysOffService.create(
      barberId,
      dto,
    );
  }

  @Get(':barberId/days-off')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  findByBarber(
    @Param('barberId') barberId: string,
  ) {
    return this.daysOffService.findByBarber(
      barberId,
    );
  }

  @Delete(':barberId/days-off/:date')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  remove(
    @Param('barberId') barberId: string,
    @Param('date') date: string,
  ) {
    return this.daysOffService.remove(
      barberId,
      date,
    );
  }
}