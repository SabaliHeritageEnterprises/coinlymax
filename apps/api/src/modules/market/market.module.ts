import { Module } from '@nestjs/common';
import { MarketService } from './market.service';
import { MarketController } from './market.controller';
import { MarketGateway } from './market.gateway';
import { PriceFeedService } from './price-feed.service';

@Module({
  controllers: [MarketController],
  providers: [MarketService, MarketGateway, PriceFeedService],
  exports: [MarketService, PriceFeedService],
})
export class MarketModule {}
