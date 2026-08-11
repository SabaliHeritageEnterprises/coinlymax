import { Controller, Get, Delete, Post, Param } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.sessions.listDevices(user.id, user.sessionId);
  }

  @Delete('others')
  revokeOthers(@CurrentUser() user: AuthUser) {
    return this.sessions.revokeOthers(user.id, user.sessionId);
  }

  @Delete(':id')
  revoke(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.sessions.revoke(userId, id);
  }
}
