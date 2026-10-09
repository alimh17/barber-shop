import { IsUUID } from 'class-validator';

export class CreateSalonMembershipDto {
  @IsUUID()
  userId: string;
}