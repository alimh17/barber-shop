import {
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';

import { UserRole } from '../../generated/prisma/client.js';

export interface CurrentUserData {
  id: string;
  phone: string;
  role: UserRole;
}

export const CurrentUser = createParamDecorator(
  (
    _data: unknown,
    ctx: ExecutionContext,
  ): CurrentUserData => {
    const request = ctx.switchToHttp().getRequest();

    return request.user;
  },
);