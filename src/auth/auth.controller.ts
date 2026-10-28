import { Body, Controller, Get, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
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
  async verifyOtp(@Body() dto: VerifyOtpDto, @Res({ passthrough: true }) res: Response) {
    const { refreshToken, ...result } = await this.authService.verifyOtp(dto);
    this.setRefreshCookie(res, refreshToken);
    return result;
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
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = this.getCookie(req, 'barbershop_refresh');
    if (!token) throw new UnauthorizedException('Missing refresh cookie');
    const { refreshToken, ...result } = await this.authService.refresh(token);
    this.setRefreshCookie(res, refreshToken);
    return result;
  }

  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Log out', description: 'Revokes the stored refresh-token hash for the authenticated account.' })
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const user = (req as Request & { user: { id: string } }).user;
    await this.authService.logout(user.id);
    res.clearCookie('barbershop_refresh', { path: '/api/auth' });
    return { message: 'Logged out successfully' };
  }

  private getCookie(req: Request, name: string): string | undefined {
    const entry = req.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith(`${name}=`));
    return entry ? decodeURIComponent(entry.slice(name.length + 1)) : undefined;
  }

  private setRefreshCookie(res: Response, token: string) {
    res.cookie('barbershop_refresh', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }
}
