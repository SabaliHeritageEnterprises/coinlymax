import { Injectable, Logger } from '@nestjs/common';
import { LoginStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UserGateway } from '../../realtime/user.gateway';

export interface LoginEventInput {
  status: LoginStatus;
  email: string;
  username?: string | null;
  userId?: string | null;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Audit-grade recorder for every authentication event (login / logout /
 * register / failed attempt). Persists to `login_events` and pushes the new
 * event live to all connected admin dashboards so they update within seconds.
 */
@Injectable()
export class LoginEventService {
  private readonly logger = new Logger(LoginEventService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: UserGateway,
  ) {}

  async record(input: LoginEventInput): Promise<void> {
    try {
      const event = await this.prisma.loginEvent.create({
        data: {
          status: input.status,
          email: input.email,
          username: input.username ?? null,
          userId: input.userId ?? null,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          metadata: input.metadata as object,
        },
      });
      // Live push to admin dashboards (they also poll as a fallback).
      this.gateway.emitToAdmins('admin:login-event', {
        ...event,
        online: input.userId ? this.gateway.isOnline(input.userId) : false,
      });
    } catch (e) {
      // Auditing must never break the auth flow.
      this.logger.warn(`Failed to record login event: ${(e as Error).message}`);
    }
  }

  /** Recent login events for the admin "Recent User Activity" section. */
  list(limit = 100) {
    return this.prisma.loginEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /** Count events created after a given time (for the "new since last view" badge). */
  countSince(since: Date) {
    return this.prisma.loginEvent.count({ where: { createdAt: { gt: since } } });
  }
}
