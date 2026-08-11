import { Controller, Get, Post, Delete, Patch, Body, Param } from '@nestjs/common';
import { WatchlistService } from './watchlist.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('watchlist')
export class WatchlistController {
  constructor(private readonly watchlist: WatchlistService) {}

  @Get('favorites')
  favorites(@CurrentUser('id') userId: string) {
    return this.watchlist.listFavorites(userId);
  }

  @Post('favorites/:symbol')
  toggleFavorite(@CurrentUser('id') userId: string, @Param('symbol') symbol: string) {
    return this.watchlist.toggleFavorite(userId, symbol);
  }

  @Get()
  lists(@CurrentUser('id') userId: string) {
    return this.watchlist.listWatchlists(userId);
  }

  @Post()
  create(@CurrentUser('id') userId: string, @Body('name') name: string) {
    return this.watchlist.createWatchlist(userId, name);
  }

  @Patch(':id/layout')
  saveLayout(@CurrentUser('id') userId: string, @Param('id') id: string, @Body('layout') layout: object) {
    return this.watchlist.saveLayout(userId, id, layout);
  }

  @Post(':id/items')
  addItem(@CurrentUser('id') userId: string, @Param('id') id: string, @Body('symbol') symbol: string) {
    return this.watchlist.addItem(userId, id, symbol);
  }

  @Delete(':id/items/:pairId')
  removeItem(@CurrentUser('id') userId: string, @Param('id') id: string, @Param('pairId') pairId: string) {
    return this.watchlist.removeItem(userId, id, pairId);
  }
}
