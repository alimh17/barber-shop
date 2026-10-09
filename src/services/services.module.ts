import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { SalonsModule } from '../salons/salons.module.js';

import { ServicesController } from './services.controller.js';
import { ServicesService } from './services.service.js';

@Module({
  imports: [AuthModule, SalonsModule],
  controllers: [ServicesController],
  providers: [ServicesService],
  exports: [ServicesService],
})
export class ServicesModule {}
