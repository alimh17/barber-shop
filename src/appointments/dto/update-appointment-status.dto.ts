import { IsEnum } from 'class-validator';

import { AppointmentStatus } from '../../generated/prisma/client.js';

export class UpdateAppointmentStatusDto {
  @IsEnum(AppointmentStatus)
  status: AppointmentStatus;
}