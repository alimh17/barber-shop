import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AuthService } from './auth.service.js';
import { RequestOtpDto } from './dto/request-otp.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { VerifyOtpDto } from './dto/verify-otp.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { OtpRateLimitGuard } from './guards/otp-rate-limit.guard.js';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('request-otp')
  @ApiOperation({ summary: 'Request an OTP', description: 'Normalizes the Iranian mobile number, applies rate limits, and creates a short-lived one-time password. In development only, the response also contains the generated otp field; staging and production never expose it.' })
  @UseGuards(OtpRateLimitGuard)
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestOtp(dto);
  }

  @Post('verify-otp')
  @ApiOperation({ summary: 'Verify OTP and sign in', description: 'Consumes a valid OTP, creates a customer when needed, and returns access and refresh tokens.' })
  @UseGuards(OtpRateLimitGuard)
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current identity', description: 'Returns the authenticated identity embedded in the validated access token.' })
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request) {
    return req.user;
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access', description: 'Validates a refresh token and rotates the user token pair.' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Log out', description: 'Revokes the stored refresh-token hash for the authenticated account.' })
  @UseGuards(JwtAuthGuard)
  logout(@Req() req: Request) {
    const user = (req as Request & { user: { id: string } }).user;
    return this.authService.logout(user.id);
  }
}
