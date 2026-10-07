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

import { CreateSalonDto } from './dto/create-salon.dto.js';
import { UpdateSalonDto } from './dto/update-salon.dto.js';
import { SalonsService } from './salons.service.js';

@Controller('salons')
export class SalonsController {
  constructor(
    private readonly salonsService: SalonsService,
  ) {}

  @Get()
  findAll() {
    return this.salonsService.findAll();
  }

  @Get(':id')
  findById(
    @Param('id') id: string,
  ) {
    return this.salonsService.findById(id);
  }

  @Post()
  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
  )
  @Roles(
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
  )
  create(
    @Body() dto: CreateSalonDto,
  ) {
    return this.salonsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
  )
  @Roles(
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
  )
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSalonDto,
  ) {
    return this.salonsService.update(
      id,
      dto,
    );
  }

  @Delete(':id')
  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
  )
  @Roles(
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
  )
  remove(
    @Param('id') id: string,
  ) {
    return this.salonsService.remove(id);
  }
}