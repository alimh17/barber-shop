import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { SalonsModule } from '../salons/salons.module.js';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

@Module({
  imports: [AuthModule, SalonsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
