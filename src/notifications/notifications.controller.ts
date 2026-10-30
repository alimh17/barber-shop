import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { CurrentUserData } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import {
  RemovePushSubscriptionDto,
  SavePushSubscriptionDto,
} from './dto/push-subscription.dto.js';
import { NotificationsService } from './notifications.service.js';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('configuration')
  @ApiOperation({ summary: 'Get Web Push public configuration' })
  getConfiguration() {
    return this.notificationsService.getPublicConfiguration();
  }

  @Post('subscriptions')
  @ApiOperation({ summary: 'Register this browser for Web Push notifications' })
  subscribe(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: SavePushSubscriptionDto,
  ) {
    return this.notificationsService.saveSubscription(user.id, dto);
  }

  @Delete('subscriptions')
  @ApiOperation({
    summary: 'Unregister this browser from Web Push notifications',
  })
  unsubscribe(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: RemovePushSubscriptionDto,
  ) {
    return this.notificationsService.removeSubscription(user.id, dto.endpoint);
  }
}
