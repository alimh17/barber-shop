
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

import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { CurrentUserData } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';

import { CreateSalonDto } from './dto/create-salon.dto.js';
import { UpdateSalonDto } from './dto/update-salon.dto.js';
import { CreateSalonMembershipDto } from './dto/create-salon-membership.dto.js';
import { SalonsService } from './salons.service.js';

@ApiTags('Salons')
@Controller('salons')
export class SalonsController {
  constructor(
    private readonly salonsService: SalonsService,
  ) {}

  // Public: list active salons.
  @Get()
  @ApiOperation({ summary: 'List active salons', description: 'Public directory of active salons ordered by creation time.' })
  findAll() {
    return this.salonsService.findAll();
  }

  // Public: get salon details.
  @Get(':id')
  @ApiOperation({ summary: 'Get salon details', description: 'Returns one active salon by its identifier.' })
  findById(
    @Param('id') id: string,
  ) {
    return this.salonsService.findById(id);
  }

  // Only SUPER_ADMIN can create a salon.
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a salon', description: 'Creates a salon with a unique slug. Restricted to super administrators.' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  create(
    @Body() dto: CreateSalonDto,
  ) {
    return this.salonsService.create(dto);
  }

  // SUPER_ADMIN can assign an ADMIN to a salon.
  @Post(':id/memberships')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Assign a salon administrator', description: 'Creates or reactivates an administrator membership for the selected salon.' })
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
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke salon administration', description: 'Deactivates a user membership without deleting its history.' })
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
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a salon', description: 'Updates salon profile fields after active-membership access validation.' })
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
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Deactivate a salon', description: 'Soft-deactivates a salon after validating administrative access.' })
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
