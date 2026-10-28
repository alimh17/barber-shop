import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';

import { AvailabilityService } from './availability.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { CurrentUserData } from '../auth/decorators/current-user.decorator.js';
import { SalonAccessService } from '../salons/salon-access.service.js';
import { GetAvailabilityDto } from './dto/get-availability.dto.js';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Availability')
@Controller('availability')
@UseGuards(JwtAuthGuard)
export class AvailabilityController {
  constructor(
    private readonly availabilityService: AvailabilityService,
    private readonly salonAccessService: SalonAccessService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get available booking slots', description: 'Builds bookable time slots from working hours, days off, service duration, timezone, and existing appointments.' })
  async getAvailability(@Query() dto: GetAvailabilityDto, @CurrentUser() user: CurrentUserData) {
    await this.salonAccessService.assertCanAccessSalon(user.id, user.role, dto.salonId);
    return this.availabilityService.getAvailability(dto);
  }
}
