import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';

import { BarbersController } from './barbers.controller.js';
import { BarbersService } from './barbers.service.js';

@Module({
  imports: [AuthModule],
  controllers: [BarbersController],
  providers: [BarbersService],
  exports: [BarbersService],
})
export class BarbersModule {}