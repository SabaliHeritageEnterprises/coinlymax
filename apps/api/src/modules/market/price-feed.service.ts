import { Injectable, OnModuleInit, Logger, Inject } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { MarketGateway, Ticker } from './market.gateway';

/**
 * Simulated real-time price engine.
 *
 * Runs a random-walk over every active pair and pushes updates to clients via
 * the WebSocket gateway, caching the latest ticker in Redis. The DB snapshot is
 * flushed periodically (not every tick) to avoid write amplification.
 *
 * To go live: swap `tick()` for a connector to Binance/CoinGecko (crypto) and an
 * FX provider (forex). The gateway + Redis cache contracts stay identical.
 */
@Injectable()
export class PriceFeedService implements OnModuleInit {
  private readonly logger = new Logger(PriceFeedService.name);
  private state = new Map<string, Ticker & { open24h: number }>();
  private dirty = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: MarketGateway,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async onModuleInit() {
    const pairs = await this.prisma.marketPair.findMany({ where: { status: 'ACTIVE' } });
    const now = Date.now();
    for (const p of pairs) {
      const price = Number(p.lastPrice);
      this.state.set(p.symbol, {
        symbol: p.symbol,
        price,
        change24h: Number(p.change24h),
        high24h: price * 1.02,
        low24h: price * 0.98,
        volume24h: Number(p.volume24h) || price * 1000,
        ts: now,
        open24h: price / (1 + Number(p.change24h) / 100 || 1),
      });
    }
    this.logger.log(`Price feed initialised for ${this.state.size} pairs`);
  }

  /** Tick every 2s: random-walk each price, broadcast, cache. */
  @Interval(2000)
  async tick() {
    if (this.state.size === 0) return;
    const snapshot: Ticker[] = [];

    for (const [symbol, s] of this.state) {
      // Volatility scaled to price magnitude; forex moves less than crypto.
      const volPct = symbol.endsWith('USDT') ? 0.0009 : 0.0003;
      const drift = (Math.random() - 0.5) * 2 * volPct;
      const newPrice = Math.max(s.price * (1 + drift), 0.000001);

      s.price = newPrice;
      s.high24h = Math.max(s.high24h, newPrice);
      s.low24h = Math.min(s.low24h, newPrice);
      s.change24h = ((newPrice - s.open24h) / s.open24h) * 100;
      s.volume24h += Math.abs(drift) * newPrice * 1000;
      s.ts = Date.now();

      const ticker: Ticker = {
        symbol: s.symbol,
        price: s.price,
        change24h: s.change24h,
        high24h: s.high24h,
        low24h: s.low24h,
        volume24h: s.volume24h,
        ts: s.ts,
      };
      snapshot.push(ticker);
      this.gateway.emitTicker(ticker);
      this.dirty.add(symbol);
      // Cache latest for REST consumers / trade fills.
      void this.redis.set(`ticker:${symbol}`, JSON.stringify(ticker), 'EX', 30);
    }

    this.gateway.emitSnapshot(snapshot);
  }

  /** Persist snapshots to the DB every 15s (decoupled from the broadcast tick). */
  @Interval(15000)
  async flush() {
    if (this.dirty.size === 0) return;
    const updates = [...this.dirty].map((symbol) => {
      const s = this.state.get(symbol)!;
      return this.prisma.marketPair.update({
        where: { symbol },
        data: {
          lastPrice: s.price,
          change24h: s.change24h,
          high24h: s.high24h,
          low24h: s.low24h,
          volume24h: s.volume24h,
        },
      });
    });
    this.dirty.clear();
    try {
      await this.prisma.$transaction(updates);
    } catch (e) {
      this.logger.warn(`Snapshot flush failed: ${(e as Error).message}`);
    }
  }

  /** Latest cached price for trade-fill logic. Falls back to in-memory state. */
  async getLastPrice(symbol: string): Promise<number | null> {
    const cached = await this.redis.get(`ticker:${symbol}`);
    if (cached) return JSON.parse(cached).price;
    return this.state.get(symbol)?.price ?? null;
  }
}
