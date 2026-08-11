import { Controller, Get, Param, Query } from '@nestjs/common';
import { MarketType } from '@prisma/client';
import { MarketService } from './market.service';
import { Public } from '../../common/decorators/public.decorator';

@Controller('market')
export class MarketController {
  constructor(private readonly market: MarketService) {}

  @Public()
  @Get('pairs')
  list(
    @Query('type') type?: MarketType,
    @Query('search') search?: string,
    @Query('trending') trending?: string,
  ) {
    return this.market.list({ type, search, trending: trending === 'true' });
  }

  @Public()
  @Get('movers')
  movers() {
    return this.market.topMovers();
  }

  @Public()
  @Get('pairs/:symbol')
  getPair(@Param('symbol') symbol: string) {
    return this.market.getBySymbol(symbol);
  }

  @Public()
  @Get('pairs/:symbol/candles')
  candles(
    @Param('symbol') symbol: string,
    @Query('interval') interval = '1h',
    @Query('limit') limit = '200',
  ) {
    return this.market.getCandles(symbol, interval, Math.min(parseInt(limit, 10) || 200, 1000));
  }
}
