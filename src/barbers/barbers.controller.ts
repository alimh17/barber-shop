
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { UserRole } from '../generated/prisma/client.js';

import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { CurrentUserData } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

import { CreateBarberDto } from './dto/create-barber.dto.js';
import { UpdateBarberDto } from './dto/update-barber.dto.js';
import { BarbersService } from './barbers.service.js';

@ApiTags('Barbers')
@ApiBearerAuth()
@Controller('barbers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BarbersController {
  constructor(
    private readonly barbersService: BarbersService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List barbers', description: 'Lists active barbers in salons visible to the caller, optionally filtered by salon.' })
  @Roles(
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.CUSTOMER,
  )
  findAll(
    @CurrentUser() user: CurrentUserData,
    @Query('salonId') salonId?: string,
  ) {
    return this.barbersService.findAll(
      user.id,
      user.role,
      salonId,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get barber details', description: 'Returns a barber profile after tenant access validation.' })
  @Roles(
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
  )
  findById(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.barbersService.findById(
      id,
      user.id,
      user.role,
    );
  }

  @Post()
  @ApiOperation({ summary: 'Create a barber', description: 'Creates or promotes a user as a barber and assigns them to an accessible salon.' })
  @Roles(
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
  )
  create(
    @Body() dto: CreateBarberDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.barbersService.create(
      dto,
      user.id,
      user.role,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a barber', description: 'Updates barber profile data in a salon managed by the caller.' })
  @Roles(
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
  )
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBarberDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.barbersService.update(
      id,
      dto,
      user.id,
      user.role,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate a barber', description: 'Soft-deactivates a barber while retaining historical records.' })
  @Roles(
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
  )
  remove(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.barbersService.remove(
      id,
      user.id,
      user.role,
    );
  }
}
