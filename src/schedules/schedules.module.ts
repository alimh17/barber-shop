import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';

import { WorkingHoursController } from './working-hours.controller.js';
import { WorkingHoursService } from './working-hours.service.js';

import { DaysOffController } from './days-off.controller.js';
import { DaysOffService } from './days-off.service.js';

@Module({
  imports: [AuthModule],
  controllers: [
    WorkingHoursController,
    DaysOffController,
  ],
  providers: [
    WorkingHoursService,
    DaysOffService,
  ],
  exports: [
    WorkingHoursService,
    DaysOffService,
  ],
})
export class SchedulesModule {}