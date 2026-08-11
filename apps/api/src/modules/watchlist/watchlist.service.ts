import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WatchlistService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Favorites (quick star toggle) ──────────────────────────────
  async listFavorites(userId: string) {
    const favs = await this.prisma.favorite.findMany({
      where: { userId },
      include: { pair: true },
      orderBy: { createdAt: 'desc' },
    });
    return favs.map((f) => f.pair);
  }

  async toggleFavorite(userId: string, symbol: string) {
    const pair = await this.prisma.marketPair.findUnique({ where: { symbol: symbol.toUpperCase() } });
    if (!pair) throw new NotFoundException('Pair not found');

    const existing = await this.prisma.favorite.findUnique({
      where: { userId_pairId: { userId, pairId: pair.id } },
    });
    if (existing) {
      await this.prisma.favorite.delete({ where: { id: existing.id } });
      return { favorited: false };
    }
    await this.prisma.favorite.create({ data: { userId, pairId: pair.id } });
    return { favorited: true };
  }

  // ── Named watchlists with saved layouts ────────────────────────
  listWatchlists(userId: string) {
    return this.prisma.watchlist.findMany({
      where: { userId },
      include: { items: { include: { pair: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  createWatchlist(userId: string, name: string) {
    return this.prisma.watchlist.create({ data: { userId, name } });
  }

  async saveLayout(userId: string, watchlistId: string, layout: object) {
    const wl = await this.prisma.watchlist.findFirst({ where: { id: watchlistId, userId } });
    if (!wl) throw new NotFoundException('Watchlist not found');
    return this.prisma.watchlist.update({ where: { id: watchlistId }, data: { layout } });
  }

  async addItem(userId: string, watchlistId: string, symbol: string) {
    const [wl, pair] = await Promise.all([
      this.prisma.watchlist.findFirst({ where: { id: watchlistId, userId } }),
      this.prisma.marketPair.findUnique({ where: { symbol: symbol.toUpperCase() } }),
    ]);
    if (!wl) throw new NotFoundException('Watchlist not found');
    if (!pair) throw new NotFoundException('Pair not found');
    return this.prisma.watchlistItem.upsert({
      where: { watchlistId_pairId: { watchlistId, pairId: pair.id } },
      update: {},
      create: { watchlistId, pairId: pair.id },
    });
  }

  async removeItem(userId: string, watchlistId: string, pairId: string) {
    const wl = await this.prisma.watchlist.findFirst({ where: { id: watchlistId, userId } });
    if (!wl) throw new NotFoundException('Watchlist not found');
    await this.prisma.watchlistItem.deleteMany({ where: { watchlistId, pairId } });
    return { ok: true };
  }
}
