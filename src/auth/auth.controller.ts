import {
    Body,
    Controller,
    Get,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { AuthService } from './auth.service.js';

import { RequestOtpDto } from './dto/request-otp.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { VerifyOtpDto } from './dto/verify-otp.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
    ) { }

    @Post('request-otp')
    requestOtp(@Body() dto: RequestOtpDto) {
        return this.authService.requestOtp(dto);
    }

    @Post('verify-otp')
    verifyOtp(@Body() dto: VerifyOtpDto) {
        return this.authService.verifyOtp(dto);
    }

    @Get('me')
    @UseGuards(JwtAuthGuard)
    me(@Req() req: Request) {
        return req.user;
    }

    @Post('refresh')
    refresh(@Body() dto: RefreshTokenDto) {
        return this.authService.refresh(
            dto.refreshToken,
        );
    }

    @Post('logout')
    @UseGuards(JwtAuthGuard)
    logout(@Req() req: Request) {
        const user = (req as Request & {
            user: {
                id: string;
            };
        }).user;

        return this.authService.logout(user.id);
    }
    
}