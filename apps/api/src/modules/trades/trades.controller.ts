import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { TradesService } from './trades.service';
import { PlaceOrderDto } from './dto/trades.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('trades')
export class TradesController {
  constructor(private readonly trades: TradesService) {}

  @Post('orders')
  place(@CurrentUser('id') userId: string, @Body() dto: PlaceOrderDto) {
    return this.trades.placeOrder(userId, dto);
  }

  @Get('orders')
  orders(@CurrentUser('id') userId: string, @Query('status') status?: OrderStatus) {
    return this.trades.listOrders(userId, status);
  }

  @Delete('orders/:id')
  cancel(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.trades.cancelOrder(userId, id);
  }

  @Get('positions')
  positions(
    @CurrentUser('id') userId: string,
    @Query('status') status: 'OPEN' | 'CLOSED' = 'OPEN',
  ) {
    return this.trades.listPositions(userId, status);
  }

  @Post('positions/:id/close')
  close(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.trades.closePosition(userId, id);
  }
}
