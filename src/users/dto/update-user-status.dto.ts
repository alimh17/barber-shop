import { IsEnum } from 'class-validator';

import { UserStatus } from '../../generated/prisma/client.js';

export class UpdateUserStatusDto {
  /** New lifecycle status for the account. */
  @IsEnum(UserStatus)
  status: UserStatus;
}
