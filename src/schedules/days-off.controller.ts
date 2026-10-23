import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '../generated/prisma/client.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CreateDayOffDto } from './dto/create-day-off.dto.js';
import { DaysOffService } from './days-off.service.js';

type AuthenticatedRequest = Request & {
  user: { id: string; role: UserRole };
};

@ApiTags('Days Off')
@ApiBearerAuth()
@Controller('barbers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DaysOffController {
  constructor(private readonly daysOffService: DaysOffService) {}

  @Post(':barberId/days-off')
  @ApiOperation({ summary: 'Create a day off', description: 'Marks a calendar date as unavailable for a barber and optionally records a reason.' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  create(
    @Param('barberId') barberId: string,
    @Body() dto: CreateDayOffDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.daysOffService.create(
      barberId,
      dto,
      req.user.id,
      req.user.role,
    );
  }

  @Get(':barberId/days-off')
  @ApiOperation({ summary: 'List barber days off', description: 'Returns registered days off for a barber visible to the caller.' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  findByBarber(
    @Param('barberId') barberId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.daysOffService.findByBarber(
      barberId,
      req.user.id,
      req.user.role,
    );
  }

  @Delete(':barberId/days-off/:date')
  @ApiOperation({ summary: 'Remove a day off', description: 'Deletes a day-off record for the supplied ISO calendar date.' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  remove(
    @Param('barberId') barberId: string,
    @Param('date') date: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.daysOffService.remove(
      barberId,
      date,
      req.user.id,
      req.user.role,
    );
  }
}
