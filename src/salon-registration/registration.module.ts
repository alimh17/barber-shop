import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { RegistrationController } from './registration.controller.js';
import { RegistrationService } from './registration.service.js';
@Module({imports:[AuthModule],controllers:[RegistrationController],providers:[RegistrationService]})
export class RegistrationModule {}
