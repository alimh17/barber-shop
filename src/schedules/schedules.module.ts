import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';

import { WorkingHoursController } from './working-hours.controller.js';
import { WorkingHoursService } from './working-hours.service.js';

@Module({
  imports: [AuthModule],
  controllers: [WorkingHoursController],
  providers: [WorkingHoursService],
  exports: [WorkingHoursService],
})
export class SchedulesModule {}