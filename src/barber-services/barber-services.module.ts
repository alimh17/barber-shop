import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';

import { BarberServicesController } from './barber-services.controller.js';
import { BarberServicesService } from './barber-services.service.js';

@Module({
  imports: [AuthModule],
  controllers: [BarberServicesController],
  providers: [BarberServicesService],
  exports: [BarberServicesService],
})
export class BarberServicesModule {}