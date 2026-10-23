import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { CurrentUserData } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { UserRole } from '../generated/prisma/client.js';
import { ListUsersDto } from './dto/list-users.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UpdateUserStatusDto } from './dto/update-user-status.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiUnauthorizedResponse({ description: 'Access token is missing, invalid, expired, or belongs to an inactive account.' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List users', description: 'Returns a filtered, paginated list. Administrators only see users connected to salons they actively manage; super administrators can see all users.' })
  @ApiOkResponse({ description: 'Paginated user list. Sensitive authentication fields are omitted.' })
  @ApiForbiddenResponse({ description: 'The caller is not an administrator or has no access to the requested salon.' })
  findAll(@CurrentUser() actor: CurrentUserData, @Query() query: ListUsersDto) {
    return this.usersService.findAll(actor.id, actor.role, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user', description: 'Returns a safe profile without refresh-token data. Access is restricted to the owner or an authorized administrator.' })
  @ApiOkResponse({ description: 'Safe user profile with active salon and barber relationships.' })
  @ApiForbiddenResponse({ description: 'The target user is outside the caller access scope.' })
  @ApiNotFoundResponse({ description: 'The user does not exist or is not visible to the caller.' })
  findOne(@Param('id') id: string, @CurrentUser() actor: CurrentUserData) {
    return this.usersService.findOne(id, actor.id, actor.role);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user profile', description: 'Updates first and last name. Users may update themselves; administrators may update users visible in their tenant scope.' })
  @ApiOkResponse({ description: 'Updated safe user profile.' })
  @ApiForbiddenResponse({ description: 'The caller cannot edit this user.' })
  @ApiNotFoundResponse({ description: 'The user does not exist or is not visible to the caller.' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() actor: CurrentUserData) {
    return this.usersService.update(id, dto, actor.id, actor.role);
  }

  @Patch(':id/status')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Change account status', description: 'Activates, deactivates, or blocks an account. A super administrator cannot change their own status.' })
  @ApiOkResponse({ description: 'User profile with the updated account status.' })
  @ApiForbiddenResponse({ description: 'The caller is not a super administrator or attempted to change their own status.' })
  @ApiNotFoundResponse({ description: 'The target user does not exist.' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateUserStatusDto, @CurrentUser() actor: CurrentUserData) {
    return this.usersService.updateStatus(id, dto.status, actor.id);
  }
}
