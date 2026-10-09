
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { SalonsModule } from '../salons/salons.module.js';

import { BarbersController } from './barbers.controller.js';
import { BarbersService } from './barbers.service.js';

@Module({
  imports: [
    AuthModule,
    SalonsModule,
  ],
  controllers: [
    BarbersController,
  ],
  providers: [
    BarbersService,
  ],
  exports: [
    BarbersService,
  ],
})
export class BarbersModule {}