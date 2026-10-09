
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

import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { CurrentUserData } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';

import { CreateSalonDto } from './dto/create-salon.dto.js';
import { UpdateSalonDto } from './dto/update-salon.dto.js';
import { CreateSalonMembershipDto } from './dto/create-salon-membership.dto.js';
import { SalonsService } from './salons.service.js';

@Controller('salons')
export class SalonsController {
  constructor(
    private readonly salonsService: SalonsService,
  ) {}

  // Public: list active salons.
  @Get()
  findAll() {
    return this.salonsService.findAll();
  }

  // Public: get salon details.
  @Get(':id')
  findById(
    @Param('id') id: string,
  ) {
    return this.salonsService.findById(id);
  }

  // Only SUPER_ADMIN can create a salon.
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  create(
    @Body() dto: CreateSalonDto,
  ) {
    return this.salonsService.create(dto);
  }

  // SUPER_ADMIN can assign an ADMIN to a salon.
  @Post(':id/memberships')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  createMembership(
    @Param('id') salonId: string,
    @Body() dto: CreateSalonMembershipDto,
  ) {
    return this.salonsService.createMembership(
      salonId,
      dto,
    );
  }

  // SUPER_ADMIN can revoke an ADMIN's access to a salon.
  @Delete(':id/memberships/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  deactivateMembership(
    @Param('id') salonId: string,
    @Param('userId') userId: string,
  ) {
    return this.salonsService.deactivateMembership(
      salonId,
      userId,
    );
  }

  // ADMIN can update only salons where they have active membership.
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
  )
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSalonDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.salonsService.update(
      id,
      dto,
      user.id,
      user.role,
    );
  }

  // ADMIN can deactivate only salons where they have active membership.
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
  )
  remove(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.salonsService.remove(
      id,
      user.id,
      user.role,
    );
  }
}