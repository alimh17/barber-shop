import { IsNotEmpty, IsString } from 'class-validator';

import { CreateAppointmentDto } from './create-appointment.dto.js';

export class CreateAdminAppointmentDto extends CreateAppointmentDto {
  @IsString()
  @IsNotEmpty()
  customerId: string;
}
