import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { AdminService, Actor } from './admin.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import {
  CreatePairDto,
  UpdatePairDto,
  BroadcastNotificationDto,
  AdminCreateUserDto,
  AdminUpdateUserDto,
  AdminUpdateSettingsDto,
  AdminResetPasswordDto,
  SendUserNotificationDto,
} from './dto/admin.dto';

// Entire controller requires at least ADMIN (enforced by the global RolesGuard).
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  private actor(user: AuthUser): Actor {
    return { id: user.id, role: user.role as Role };
  }

  // ── Analytics ──────────────────────────────────────────────────
  @Get('analytics')
  analytics() {
    return this.admin.analytics();
  }

  // ── Users: list / inspect ──────────────────────────────────────
  @Get('users')
  users(@Query('search') search?: string, @Query('take') take = '50', @Query('skip') skip = '0') {
    return this.admin.listUsers(search, parseInt(take, 10), parseInt(skip, 10));
  }

  @Get('users/:id')
  userDashboard(@Param('id') id: string) {
    return this.admin.getUserDashboard(id);
  }

  @Get('users/:id/activity')
  userActivity(@Param('id') id: string) {
    return this.admin.getUserActivity(id);
  }

  // ── Users: create / edit / manage ──────────────────────────────
  @Post('users')
  createUser(@CurrentUser() user: AuthUser, @Body() dto: AdminCreateUserDto) {
    return this.admin.createUser(this.actor(user), dto);
  }

  @Patch('users/:id')
  updateUser(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AdminUpdateUserDto) {
    return this.admin.updateUser(this.actor(user), id, dto);
  }

  @Patch('users/:id/settings')
  updateUserSettings(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AdminUpdateSettingsDto) {
    return this.admin.updateUserSettings(this.actor(user), id, dto);
  }

  @Post('users/:id/reset-password')
  resetPassword(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AdminResetPasswordDto) {
    return this.admin.resetUserPassword(this.actor(user), id, dto);
  }

  @Post('users/:id/notify')
  notifyUser(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SendUserNotificationDto) {
    return this.admin.notifyUser(this.actor(user), id, dto);
  }

  @Delete('users/:id')
  deleteUser(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.admin.deleteUser(this.actor(user), id);
  }

  // ── Market pairs ───────────────────────────────────────────────
  @Post('pairs')
  createPair(@CurrentUser('id') actorId: string, @Body() dto: CreatePairDto) {
    return this.admin.createPair(actorId, dto);
  }

  @Patch('pairs/:id')
  updatePair(@CurrentUser('id') actorId: string, @Param('id') id: string, @Body() dto: UpdatePairDto) {
    return this.admin.updatePair(actorId, id, dto);
  }

  // ── Notifications ──────────────────────────────────────────────
  @Post('notifications/broadcast')
  broadcast(@CurrentUser() user: AuthUser, @Body() dto: BroadcastNotificationDto) {
    return this.admin.broadcast(this.actor(user), dto);
  }

  // ── Logs ───────────────────────────────────────────────────────
  @Get('logs/admin')
  adminLogs() {
    return this.admin.adminLogs();
  }

  @Get('logs/activity')
  activityLogs() {
    return this.admin.activityLogs();
  }
}
