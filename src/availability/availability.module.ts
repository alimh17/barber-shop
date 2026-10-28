import { Module } from '@nestjs/common';

import { AvailabilityController } from './availability.controller.js';
import { AvailabilityService } from './availability.service.js';
import { SalonsModule } from '../salons/salons.module.js';

@Module({
  imports: [SalonsModule],
  controllers: [AvailabilityController],
  providers: [AvailabilityService],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}