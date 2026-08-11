import { Controller, Get, Patch, Post, Body, Req } from '@nestjs/common';
import { Request } from 'express';
import { UsersService } from './users.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { UpdateProfileDto, UpdateSettingsDto, ChangePasswordDto } from './dto/users.dto';

@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly activity: ActivityLogService,
  ) {}

  @Get('me')
  profile(@CurrentUser('id') userId: string) {
    return this.users.getProfile(userId);
  }

  @Patch('me')
  updateProfile(@CurrentUser('id') userId: string, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(userId, dto);
  }

  @Patch('me/settings')
  updateSettings(@CurrentUser('id') userId: string, @Body() dto: UpdateSettingsDto) {
    return this.users.updateSettings(userId, dto);
  }

  @Post('me/change-password')
  changePassword(@CurrentUser('id') userId: string, @Body() dto: ChangePasswordDto, @Req() req: Request) {
    return this.users.changePassword(userId, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('me/portfolio')
  portfolio(@CurrentUser('id') userId: string) {
    return this.users.getPortfolio(userId);
  }

  @Get('me/activity')
  activityLog(@CurrentUser('id') userId: string) {
    return this.activity.listForUser(userId);
  }
}
