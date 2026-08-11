import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma, OrderType, OrderSide, OrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PriceFeedService } from '../market/price-feed.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PlaceOrderDto } from './dto/trades.dto';

/**
 * Simulation-only matching engine. No real funds, no real execution.
 *  - MARKET orders fill instantly against the latest feed price.
 *  - LIMIT / STOP_LIMIT orders are recorded as OPEN and filled by the cron sweep
 *    in `processOpenOrders()` when the market crosses their trigger.
 */
@Injectable()
export class TradesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly feed: PriceFeedService,
    private readonly activity: ActivityLogService,
    private readonly notifications: NotificationsService,
  ) {}

  async placeOrder(userId: string, dto: PlaceOrderDto) {
    const pair = await this.prisma.marketPair.findUnique({ where: { symbol: dto.symbol.toUpperCase() } });
    if (!pair || pair.status !== 'ACTIVE') throw new NotFoundException('Market pair unavailable');

    const lastPrice = await this.feed.getLastPrice(pair.symbol);
    if (lastPrice == null) throw new BadRequestException('No live price available');

    if (dto.type !== OrderType.MARKET && !dto.price) {
      throw new BadRequestException('Limit orders require a price');
    }

    const isMarket = dto.type === OrderType.MARKET;
    const fillPrice = isMarket ? lastPrice : dto.price!;
    const notional = new Prisma.Decimal(fillPrice).mul(dto.quantity);

    // Margin/funds check (paper balance, BUY only — SELL assumes you hold the asset).
    if (dto.side === OrderSide.BUY) {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { paperBalance: true } });
      if (!user || new Prisma.Decimal(user.paperBalance).lt(notional)) {
        throw new BadRequestException('Insufficient paper balance');
      }
    }

    if (isMarket) {
      return this.fillMarketOrder(userId, pair.id, pair.symbol, dto, lastPrice, notional);
    }

    // Resting limit/stop order.
    const trade = await this.prisma.trade.create({
      data: {
        userId,
        pairId: pair.id,
        side: dto.side,
        type: dto.type,
        status: OrderStatus.OPEN,
        price: new Prisma.Decimal(dto.price!),
        quantity: new Prisma.Decimal(dto.quantity),
        notional,
        stopPrice: dto.stopPrice ? new Prisma.Decimal(dto.stopPrice) : null,
        takeProfit: dto.takeProfit ? new Prisma.Decimal(dto.takeProfit) : null,
        stopLoss: dto.stopLoss ? new Prisma.Decimal(dto.stopLoss) : null,
      },
    });
    await this.activity.record(userId, 'ORDER_PLACED', {}, { symbol: pair.symbol, type: dto.type });
    return trade;
  }

  private async fillMarketOrder(
    userId: string,
    pairId: string,
    symbol: string,
    dto: PlaceOrderDto,
    price: number,
    notional: Prisma.Decimal,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const trade = await tx.trade.create({
        data: {
          userId,
          pairId,
          side: dto.side,
          type: OrderType.MARKET,
          status: OrderStatus.FILLED,
          price: new Prisma.Decimal(price),
          filledPrice: new Prisma.Decimal(price),
          quantity: new Prisma.Decimal(dto.quantity),
          filledQty: new Prisma.Decimal(dto.quantity),
          notional,
          takeProfit: dto.takeProfit ? new Prisma.Decimal(dto.takeProfit) : null,
          stopLoss: dto.stopLoss ? new Prisma.Decimal(dto.stopLoss) : null,
          filledAt: new Date(),
        },
      });

      // Adjust paper balance: BUY debits cash, SELL credits.
      const delta = dto.side === OrderSide.BUY ? notional.neg() : notional;
      await tx.user.update({
        where: { id: userId },
        data: { paperBalance: { increment: delta } },
      });

      // Open a position record (simplified: one position per fill).
      await tx.position.create({
        data: {
          userId,
          pairId,
          side: dto.side,
          status: 'OPEN',
          entryPrice: new Prisma.Decimal(price),
          quantity: new Prisma.Decimal(dto.quantity),
        },
      });

      return trade;
    });
  }

  async cancelOrder(userId: string, tradeId: string) {
    const trade = await this.prisma.trade.findUnique({ where: { id: tradeId } });
    if (!trade) throw new NotFoundException('Order not found');
    if (trade.userId !== userId) throw new ForbiddenException('Not your order');
    if (trade.status !== OrderStatus.OPEN) throw new BadRequestException('Order is not open');

    return this.prisma.trade.update({
      where: { id: tradeId },
      data: { status: OrderStatus.CANCELLED },
    });
  }

  async closePosition(userId: string, positionId: string) {
    const position = await this.prisma.position.findUnique({
      where: { id: positionId },
      include: { pair: true },
    });
    if (!position) throw new NotFoundException('Position not found');
    if (position.userId !== userId) throw new ForbiddenException('Not your position');
    if (position.status !== 'OPEN') throw new BadRequestException('Position already closed');

    const exit = (await this.feed.getLastPrice(position.pair.symbol)) ?? Number(position.entryPrice);
    const dir = position.side === OrderSide.BUY ? 1 : -1;
    const pnl = new Prisma.Decimal(exit)
      .minus(position.entryPrice)
      .mul(position.quantity)
      .mul(dir);
    const proceeds = new Prisma.Decimal(exit).mul(position.quantity).mul(dir === 1 ? 1 : -1);

    await this.prisma.$transaction([
      this.prisma.position.update({
        where: { id: positionId },
        data: { status: 'CLOSED', exitPrice: new Prisma.Decimal(exit), realizedPnl: pnl, closedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { paperBalance: { increment: proceeds } },
      }),
    ]);
    return { message: 'Position closed', realizedPnl: Number(pnl), exitPrice: exit };
  }

  listOrders(userId: string, status?: OrderStatus) {
    return this.prisma.trade.findMany({
      where: { userId, ...(status ? { status } : {}) },
      include: { pair: { select: { symbol: true, displayName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  listPositions(userId: string, status: 'OPEN' | 'CLOSED' = 'OPEN') {
    return this.prisma.position.findMany({
      where: { userId, status },
      include: { pair: { select: { symbol: true, displayName: true, lastPrice: true } } },
      orderBy: { openedAt: 'desc' },
      take: 100,
    });
  }
}
