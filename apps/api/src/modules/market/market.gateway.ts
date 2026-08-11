import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

export interface Ticker {
  symbol: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  ts: number;
}

/**
 * Real-time market data gateway.
 * Clients connect, optionally join per-symbol rooms, and receive `ticker` events.
 * A market-wide `tickers` snapshot is also broadcast on each tick.
 */
@WebSocketGateway({
  cors: { origin: true, credentials: true },
  namespace: '/market',
})
export class MarketGateway implements OnGatewayConnection {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(MarketGateway.name);

  handleConnection(client: Socket) {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  @SubscribeMessage('subscribe')
  onSubscribe(@MessageBody() symbols: string[], @ConnectedSocket() client: Socket) {
    (symbols ?? []).forEach((s) => client.join(`sym:${s.toUpperCase()}`));
    return { ok: true, subscribed: symbols };
  }

  @SubscribeMessage('unsubscribe')
  onUnsubscribe(@MessageBody() symbols: string[], @ConnectedSocket() client: Socket) {
    (symbols ?? []).forEach((s) => client.leave(`sym:${s.toUpperCase()}`));
    return { ok: true };
  }

  /** Broadcast a single ticker to its room + the global feed. */
  emitTicker(ticker: Ticker) {
    this.server.to(`sym:${ticker.symbol}`).emit('ticker', ticker);
  }

  /** Broadcast the full snapshot (used by markets page / landing ticker). */
  emitSnapshot(tickers: Ticker[]) {
    this.server.emit('tickers', tickers);
  }
}
