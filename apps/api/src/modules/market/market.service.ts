import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MarketType } from '@prisma/client';

export interface Candle {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

@Injectable()
export class MarketService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: { type?: MarketType; search?: string; trending?: boolean }) {
    return this.prisma.marketPair.findMany({
      where: {
        status: 'ACTIVE',
        ...(params.type ? { type: params.type } : {}),
        ...(params.trending ? { isTrending: true } : {}),
        ...(params.search
          ? {
              OR: [
                { symbol: { contains: params.search, mode: 'insensitive' } },
                { displayName: { contains: params.search, mode: 'insensitive' } },
                { base: { contains: params.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ isTrending: 'desc' }, { sortOrder: 'asc' }],
    });
  }

  async topMovers(limit = 5) {
    const pairs = await this.prisma.marketPair.findMany({ where: { status: 'ACTIVE' } });
    const sorted = [...pairs].sort((a, b) => Number(b.change24h) - Number(a.change24h));
    return {
      gainers: sorted.slice(0, limit),
      losers: sorted.slice(-limit).reverse(),
    };
  }

  async getBySymbol(symbol: string) {
    const pair = await this.prisma.marketPair.findUnique({ where: { symbol: symbol.toUpperCase() } });
    if (!pair) throw new NotFoundException(`Unknown market pair: ${symbol}`);
    return pair;
  }

  /**
   * Deterministic-ish synthetic OHLC history for charting/back-testing the UI.
   * Generates `count` candles ending at the pair's current last price.
   * Replace with a real OHLC provider when integrating a licensed data feed.
   */
  async getCandles(symbol: string, interval: string, count = 200): Promise<Candle[]> {
    const pair = await this.getBySymbol(symbol);
    const stepSec = this.intervalSeconds(interval);
    const now = Math.floor(Date.now() / 1000);
    const start = now - stepSec * count;

    const candles: Candle[] = [];
    let price = Number(pair.lastPrice) * 0.96; // walk up toward current price
    const vol = Number(pair.lastPrice) * 0.004 + 0.0001;

    for (let i = 0; i < count; i++) {
      const time = start + i * stepSec;
      // Pseudo-random but seeded by index+symbol so the chart is stable across reloads.
      const seed = this.hashSeed(`${pair.symbol}:${interval}:${i}`);
      const drift = (Math.sin(i / 9) + Math.cos(i / 17)) * vol;
      const noise = (seed - 0.5) * vol * 2;
      const open = price;
      const close = Math.max(open + drift + noise, 0.00001);
      const high = Math.max(open, close) + Math.abs(noise) * 0.6;
      const low = Math.min(open, close) - Math.abs(noise) * 0.6;
      const volume = Number(pair.volume24h) / count || seed * 1000;
      candles.push({ time, open, high, low, close, volume });
      price = close;
    }
    return candles;
  }

  private hashSeed(s: string): number {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ((h >>> 0) % 1000) / 1000;
  }

  private intervalSeconds(interval: string): number {
    const map: Record<string, number> = {
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '1h': 3600,
      '4h': 14400,
      '1d': 86400,
    };
    return map[interval] ?? 3600;
  }
}
