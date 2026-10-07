import {
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';

export interface CurrentUserData {
  id: string;
  phone: string;
  role: string;
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