import {
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { OtpService } from '../otp/otp.service.js';
import { UsersService } from '../users/users.service.js';

import { RequestOtpDto } from './dto/request-otp.dto.js';
import { VerifyOtpDto } from './dto/verify-otp.dto.js';

@Injectable()
export class AuthService {
    constructor(
        private readonly usersService: UsersService,
        private readonly otpService: OtpService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) { }

    async requestOtp(dto: RequestOtpDto) {
        const result = await this.otpService.generate(dto.phone);

        return {
            message: 'OTP sent successfully',
            expiresAt: result.expiresAt,

            // فقط برای development
            otp: result.code,
        };
    }

    async verifyOtp(dto: VerifyOtpDto) {
        await this.otpService.verify(
            dto.phone,
            dto.code,
        );

        let user = await this.usersService.findByPhone(
            dto.phone,
        );

        if (!user) {
            user = await this.usersService.createCustomer(
                dto.phone,
            );
        }

        if (user.status !== 'ACTIVE') {
            throw new UnauthorizedException(
                'User is not active',
            );
        }

        return this.generateTokens(user);
    }

    private async generateTokens(user: {
        id: string;
        phone: string;
        role: string;
    }) {
        const payload = {
            sub: user.id,
            phone: user.phone,
            role: user.role,
        };

        const accessToken =
            await this.jwtService.signAsync(payload);

        const refreshToken =
            await this.jwtService.signAsync(payload, {
                secret: this.configService.getOrThrow<string>(
                    'JWT_REFRESH_SECRET',
                ),
                expiresIn: '7d',
            });

        const refreshTokenHash =
            await bcrypt.hash(refreshToken, 10);

        await this.usersService.updateRefreshToken(
            user.id,
            refreshTokenHash,
        );

        return {
            accessToken,
            refreshToken,

            user: {
                id: user.id,
                phone: user.phone,
                role: user.role,
            },
        };
    }



    async refresh(refreshToken: string) {
        let payload: {
            sub: string;
            phone: string;
            role: string;
        };

        try {
            payload = await this.jwtService.verifyAsync(
                refreshToken,
                {
                    secret:
                        this.configService.getOrThrow<string>(
                            'JWT_REFRESH_SECRET',
                        ),
                },
            );
        } catch {
            throw new UnauthorizedException(
                'Invalid refresh token',
            );
        }

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

        if (!user.refreshTokenHash) {
            throw new UnauthorizedException(
                'Refresh token is revoked',
            );
        }

        const isValid = await bcrypt.compare(
            refreshToken,
            user.refreshTokenHash,
        );

        if (!isValid) {
            throw new UnauthorizedException(
                'Invalid refresh token',
            );
        }

        return this.generateTokens(user);
    }


    async logout(userId: string) {
        await this.usersService.updateRefreshToken(
            userId,
            null,
        );

        return {
            message: 'Logged out successfully',
        };
    }
}