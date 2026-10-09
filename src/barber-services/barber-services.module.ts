import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { SalonsModule } from '../salons/salons.module.js';

import { BarberServicesController } from './barber-services.controller.js';
import { BarberServicesService } from './barber-services.service.js';

@Module({
  imports: [AuthModule, SalonsModule],
  controllers: [BarberServicesController],
  providers: [BarberServicesService],
  exports: [BarberServicesService],
})
export class BarberServicesModule {}
