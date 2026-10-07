import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { HealthModule } from './health/health.module.js';
import { UsersController } from './users/users.controller.js';
import { UsersModule } from './users/users.module.js';
import { OtpModule } from './otp/otp.module.js';
import { AuthModule } from './auth/auth.module.js';
import { SalonsService } from './salons/salons.service.js';
import { SalonsController } from './salons/salons.controller.js';
import { SalonsModule } from './salons/salons.module.js';
import { BarbersController } from './barbers/barbers.controller.js';
import { BarbersService } from './barbers/barbers.service.js';
import { BarbersModule } from './barbers/barbers.module.js';
import { ServicesController } from './services/services.controller.js';
import { ServicesService } from './services/services.service.js';
import { ServicesModule } from './services/services.module.js';
import { BarberServicesModule } from './barber-services/barber-services.module.js';
import { WorkingHoursController } from './schedules/working-hours.controller.js';
import { WorkingHoursService } from './schedules/working-hours.service.js';
import { SchedulesModule } from './schedules/schedules.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com
    // ObserveModule.forRoot({
    //   appKey: 'YOUR_APP_KEY',
    //   appSecret: 'YOUR_APP_SECRET',
    //   serviceId: 'barbershop-api',
    // }),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    HealthModule,
    UsersModule,
    OtpModule,
    AuthModule,
    SalonsModule,
    BarbersModule,
    ServicesModule,
    BarberServicesModule,
    SchedulesModule
  ],
  controllers: [AppController, UsersController, SalonsController, BarbersController, ServicesController, WorkingHoursController],
  providers: [AppService, SalonsService, BarbersService, ServicesService, WorkingHoursService],
})
export class AppModule {}
