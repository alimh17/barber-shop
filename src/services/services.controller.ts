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

import { UserRole } from '../generated/prisma/client.js';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

import { CreateServiceDto } from './dto/create-service.dto.js';
import { UpdateServiceDto } from './dto/update-service.dto.js';
import { ServicesService } from './services.service.js';

@Controller('services')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServicesController {
  constructor(
    private readonly servicesService: ServicesService,
  ) {}

  @Get()
  @Roles(
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
  )
  findAll(
    @Query('salonId') salonId?: string,
  ) {
    return this.servicesService.findAll(salonId);
  }

  @Get(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
  )
  findById(@Param('id') id: string) {
    return this.servicesService.findById(id);
  }

  @Post()
  @Roles(
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
  )
  create(@Body() dto: CreateServiceDto) {
    return this.servicesService.create(dto);
  }

  @Patch(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
  )
  update(
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    return this.servicesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
  )
  remove(@Param('id') id: string) {
    return this.servicesService.remove(id);
  }
}