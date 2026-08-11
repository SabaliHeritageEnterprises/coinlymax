import { Global, Module } from '@nestjs/common';
import { ActivityLogService } from './activity-log.service';
import { LoginEventService } from './login-event.service';

@Global()
@Module({
  providers: [ActivityLogService, LoginEventService],
  exports: [ActivityLogService, LoginEventService],
})
export class ActivityLogModule {}
