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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { UserRole } from '../generated/prisma/client.js';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { CurrentUserData } from '../auth/decorators/current-user.decorator.js';

import { AppointmentsService } from './appointments.service.js';
import { CreateAppointmentDto } from './dto/create-appointment.dto.js';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto.js';
import { CreateAdminAppointmentDto } from './dto/create-admin-appointment.dto.js';
import { UpdateAppointmentDto } from './dto/update-appointment.dto.js';

@ApiTags('Appointments')
@ApiBearerAuth()
@Controller('appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  @ApiOperation({ summary: 'Book an appointment', description: 'Creates a customer appointment after validating service assignment, availability, schedule, and overlap constraints.' })
  @Roles(UserRole.CUSTOMER)
  create(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateAppointmentDto,
  ) {
    return this.appointmentsService.create(user.id, dto);
  }

  @Post('admin')
  @ApiOperation({ summary: 'Create an appointment as administrator', description: 'Creates or resolves a customer and books an appointment within the administrator salon scope.' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  createForAdmin(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateAdminAppointmentDto,
  ) {
    return this.appointmentsService.createForAdmin(user.id, user.role, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List appointments', description: 'Returns appointments visible across salons managed by the caller; super administrators see all salons.' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  findAll(@CurrentUser() user: CurrentUserData) {
    return this.appointmentsService.findAll(user.id, user.role);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get appointment details', description: 'Returns one appointment after tenant access validation.' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  findById(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.appointmentsService.findById(id, user.id, user.role);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit an appointment', description: 'Updates notes or reschedules an appointment while revalidating availability and optimistic concurrency rules.' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.appointmentsService.update(id, dto, user.id, user.role);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Change appointment status', description: 'Applies the allowed appointment state-machine transition with concurrency protection.' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentStatusDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.appointmentsService.updateStatus(id, dto, user.id, user.role);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancel an appointment', description: 'Soft-cancels an appointment subject to tenant access and state-transition rules.' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.appointmentsService.remove(id, user.id, user.role);
  }
}
