import { Module } from '@nestjs/common';
import { TradesService } from './trades.service';
import { TradesController } from './trades.controller';
import { MarketModule } from '../market/market.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [MarketModule, NotificationsModule],
  controllers: [TradesController],
  providers: [TradesService],
})
export class TradesModule {}
