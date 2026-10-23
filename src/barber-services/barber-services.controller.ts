import {
  Controller,
  Delete,
  Get,
  Param,
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

import { BarberServicesService } from './barber-services.service.js';

@ApiTags('Barber Services')
@ApiBearerAuth()
@Controller('barbers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BarberServicesController {
  constructor(private readonly barberServicesService: BarberServicesService) {}

  @Get(':barberId/services')
  @ApiOperation({ summary: 'List a barber services', description: 'Returns active services assigned to a barber after salon access validation.' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  findByBarber(
    @Param('barberId') barberId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.barberServicesService.findByBarber(
      barberId,
      user.id,
      user.role,
    );
  }

  @Post(':barberId/services/:serviceId')
  @ApiOperation({ summary: 'Assign a service to a barber', description: 'Connects an active barber and active service from the same accessible salon.' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  attach(
    @Param('barberId') barberId: string,
    @Param('serviceId') serviceId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.barberServicesService.attach(
      barberId,
      serviceId,
      user.id,
      user.role,
    );
  }

  @Delete(':barberId/services/:serviceId')
  @ApiOperation({ summary: 'Remove a service from a barber', description: 'Removes the barber-service assignment without deleting either record.' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  detach(
    @Param('barberId') barberId: string,
    @Param('serviceId') serviceId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.barberServicesService.detach(
      barberId,
      serviceId,
      user.id,
      user.role,
    );
  }
}
