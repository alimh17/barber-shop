import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { CurrentUserData } from '../auth/decorators/current-user.decorator.js';
import { UserRole } from '../generated/prisma/client.js';
import { RegistrationDto, RejectRegistrationDto } from './registration.dto.js';
import { RegistrationService } from './registration.service.js';
@Controller('salon-registrations') @UseGuards(JwtAuthGuard)
export class RegistrationController {
 constructor(private readonly service:RegistrationService){}
 @Post() submit(@CurrentUser() u:CurrentUserData,@Body() dto:RegistrationDto){return this.service.submit(u.id,dto)}
 @Get('mine') mine(@CurrentUser() u:CurrentUserData){return this.service.mine(u.id)}
 @Get() @UseGuards(RolesGuard) @Roles(UserRole.SUPER_ADMIN) list(){return this.service.list()}
 @Post(':id/approve') @UseGuards(RolesGuard) @Roles(UserRole.SUPER_ADMIN)
 approve(@Param('id') id:string,@CurrentUser() u:CurrentUserData){return this.service.approve(id,u.id)}
 @Post(':id/reject') @UseGuards(RolesGuard) @Roles(UserRole.SUPER_ADMIN)
 reject(@Param('id') id:string,@CurrentUser() u:CurrentUserData,@Body() dto:RejectRegistrationDto){return this.service.reject(id,u.id,dto.reason)}
}
