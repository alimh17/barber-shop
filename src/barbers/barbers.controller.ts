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

import { CreateBarberDto } from './dto/create-barber.dto.js';
import { UpdateBarberDto } from './dto/update-barber.dto.js';
import { BarbersService } from './barbers.service.js';

@Controller('barbers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BarbersController {
  constructor(
    private readonly barbersService: BarbersService,
  ) {}

  @Get()
  @Roles(
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
  )
  findAll(
    @Query('salonId') salonId?: string,
  ) {
    return this.barbersService.findAll(salonId);
  }

  @Get(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
  )
  findById(@Param('id') id: string) {
    return this.barbersService.findById(id);
  }

  @Post()
  @Roles(
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
  )
  create(@Body() dto: CreateBarberDto) {
    return this.barbersService.create(dto);
  }

  @Patch(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
  )
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBarberDto,
  ) {
    return this.barbersService.update(id, dto);
  }

  @Delete(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
  )
  remove(@Param('id') id: string) {
    return this.barbersService.remove(id);
  }
}