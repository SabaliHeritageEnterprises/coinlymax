import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

/**
 * Authenticated per-user realtime channel (namespace /user).
 *
 * Clients connect with their JWT access token in the socket handshake
 * (`auth.token`). On connect we verify the token and join the socket to a
 * private room `user:<id>` plus `role:<role>`. This powers:
 *   - live admin → user pushes (notifications, account updates)
 *   - online/offline presence (counted by live socket connections)
 *   - live admin dashboard pushes (login events) to the admin role rooms
 *
 * Events emitted to clients:
 *   - 'notification' / 'account:update' / 'account:deleted'  (to a user)
 *   - 'admin:login-event' / 'admin:presence'                  (to admins)
 */
@WebSocketGateway({ cors: { origin: true, credentials: true }, namespace: '/user' })
export class UserGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(UserGateway.name);

  // userId -> number of live socket connections (a user may have several tabs/devices)
  private online = new Map<string, number>();

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.headers?.authorization as string)?.replace('Bearer ', '');
      if (!token) throw new Error('missing token');

      const payload = await this.jwt.verifyAsync(token, {
        secret: this.config.get<string>('jwt.accessSecret'),
      });
      client.data.userId = payload.sub;
      client.data.role = payload.role;
      client.join(`user:${payload.sub}`);
      client.join(`role:${payload.role}`);

      const next = (this.online.get(payload.sub) ?? 0) + 1;
      this.online.set(payload.sub, next);
      if (next === 1) this.broadcastPresence(payload.sub, true);
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.userId as string | undefined;
    if (!userId) return;
    const next = (this.online.get(userId) ?? 1) - 1;
    if (next <= 0) {
      this.online.delete(userId);
      this.broadcastPresence(userId, false);
    } else {
      this.online.set(userId, next);
    }
  }

  private broadcastPresence(userId: string, isOnline: boolean) {
    this.emitToAdmins('admin:presence', { userId, online: isOnline, at: new Date().toISOString() });
  }

  /** Snapshot of currently-connected user ids. */
  getOnlineUserIds(): string[] {
    return [...this.online.keys()];
  }

  isOnline(userId: string): boolean {
    return this.online.has(userId);
  }

  /** Push an event to a single user's devices. */
  emitToUser(userId: string, event: string, payload: unknown) {
    this.server.to(`user:${userId}`).emit(event, payload);
  }

  /** Push an event to every connected admin / super-admin dashboard. */
  emitToAdmins(event: string, payload: unknown) {
    this.server.to('role:ADMIN').to('role:SUPER_ADMIN').emit(event, payload);
  }

  /** Push an event to every connected client. */
  emitToAll(event: string, payload: unknown) {
    this.server.emit(event, payload);
  }
}
