
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';

import { SalonsController } from './salons.controller.js';
import { SalonsService } from './salons.service.js';
import { SalonAccessService } from './salon-access.service.js';

@Module({
  imports: [
    AuthModule,
  ],

  controllers: [
    SalonsController,
  ],

  providers: [
    SalonsService,
    SalonAccessService,
  ],

  exports: [
    SalonsService,
    SalonAccessService,
  ],
})
export class SalonsModule {}