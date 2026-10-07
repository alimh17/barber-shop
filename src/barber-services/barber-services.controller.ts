import {
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

import { BarberServicesService } from './barber-services.service.js';

@Controller('barbers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BarberServicesController {
  constructor(
    private readonly barberServicesService: BarberServicesService,
  ) {}

  @Get(':barberId/services')
  @Roles(
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
  )
  findByBarber(
    @Param('barberId') barberId: string,
  ) {
    return this.barberServicesService.findByBarber(
      barberId,
    );
  }

  @Post(':barberId/services/:serviceId')
  @Roles(
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
  )
  attach(
    @Param('barberId') barberId: string,
    @Param('serviceId') serviceId: string,
  ) {
    return this.barberServicesService.attach(
      barberId,
      serviceId,
    );
  }

  @Delete(':barberId/services/:serviceId')
  @Roles(
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
  )
  detach(
    @Param('barberId') barberId: string,
    @Param('serviceId') serviceId: string,
  ) {
    return this.barberServicesService.detach(
      barberId,
      serviceId,
    );
  }
}