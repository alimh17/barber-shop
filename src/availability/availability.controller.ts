import {
  Controller,
  Get,
  Query,
} from '@nestjs/common';

import { AvailabilityService } from './availability.service.js';
import { GetAvailabilityDto } from './dto/get-availability.dto.js';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Availability')
@Controller('availability')
export class AvailabilityController {
  constructor(
    private readonly availabilityService: AvailabilityService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get available booking slots', description: 'Builds bookable time slots from working hours, days off, service duration, timezone, and existing appointments.' })
  getAvailability(
    @Query() dto: GetAvailabilityDto,
  ) {
    return this.availabilityService.getAvailability(
      dto,
    );
  }
}
