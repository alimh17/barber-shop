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

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { CurrentUserData } from '../auth/decorators/current-user.decorator.js';

import { CreateServiceDto } from './dto/create-service.dto.js';
import { UpdateServiceDto } from './dto/update-service.dto.js';
import { ServicesService } from './services.service.js';

@ApiTags('Services')
@ApiBearerAuth()
@Controller('services')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  @ApiOperation({ summary: 'List salon services', description: 'Lists active services visible to the administrator, optionally scoped to one salon.' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  findAll(
    @CurrentUser() user: CurrentUserData,
    @Query('salonId') salonId?: string,
  ) {
    return this.servicesService.findAll(user.id, user.role, salonId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get service details', description: 'Returns service duration, price, and profile after salon access validation.' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  findById(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.servicesService.findById(id, user.id, user.role);
  }

  @Post()
  @ApiOperation({ summary: 'Create a service', description: 'Creates an active service in a salon managed by the caller.' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  create(@Body() dto: CreateServiceDto, @CurrentUser() user: CurrentUserData) {
    return this.servicesService.create(dto, user.id, user.role);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a service', description: 'Updates name, description, duration, or price in an accessible salon.' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.servicesService.update(id, dto, user.id, user.role);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate a service', description: 'Soft-deactivates a salon service while retaining appointment history.' })
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.servicesService.remove(id, user.id, user.role);
  }
}
