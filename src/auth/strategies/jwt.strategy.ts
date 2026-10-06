import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { UsersService } from '../../users/users.service.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(
  Strategy,
) {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest:
        ExtractJwt.fromAuthHeaderAsBearerToken(),

      ignoreExpiration: false,

      secretOrKey:
        configService.getOrThrow<string>(
          'JWT_ACCESS_SECRET',
        ),
    });
  }

  async validate(payload: {
    sub: string;
    phone: string;
    role: string;
  }) {
    const user = await this.usersService.findById(
      payload.sub,
    );

    if (!user) {
      throw new UnauthorizedException(
        'User not found',
      );
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException(
        'User is not active',
      );
    }

    return {
      id: user.id,
      phone: user.phone,
      role: user.role,
    };
  }
}