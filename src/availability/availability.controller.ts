import {
  Controller,
  Get,
  Query,
} from '@nestjs/common';

import { AvailabilityService } from './availability.service.js';
import { GetAvailabilityDto } from './dto/get-availability.dto.js';

@Controller('availability')
export class AvailabilityController {
  constructor(
    private readonly availabilityService: AvailabilityService,
  ) {}

  @Get()
  getAvailability(
    @Query() dto: GetAvailabilityDto,
  ) {
    return this.availabilityService.getAvailability(
      dto,
    );
  }
}