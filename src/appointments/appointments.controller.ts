import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { UserRole } from '../generated/prisma/client.js';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { CurrentUserData } from '../auth/decorators/current-user.decorator.js';

import { AppointmentsService } from './appointments.service.js';
import { CreateAppointmentDto } from './dto/create-appointment.dto.js';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto.js';

@Controller('appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AppointmentsController {
  constructor(
    private readonly appointmentsService: AppointmentsService,
  ) { }

  @Post()
  @Roles(
    UserRole.CUSTOMER,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
  )
  create(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateAppointmentDto,
  ) {
    return this.appointmentsService.create(user.id, dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  findAll(
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.appointmentsService.findAll(
      user.id,
      user.role,
    );
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  findById(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.appointmentsService.findById(
      id,
      user.id,
      user.role,
    );
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentStatusDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.appointmentsService.updateStatus(
      id,
      dto,
      user.id,
      user.role,
    );
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  remove(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.appointmentsService.remove(
      id,
      user.id,
      user.role,
    );
  }
}