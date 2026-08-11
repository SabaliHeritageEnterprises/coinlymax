import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class ActivityLogService {
  constructor(private readonly prisma: PrismaService) {}

  /** Fire-and-forget audit trail entry. Never throws into the calling flow. */
  async record(
    userId: string,
    action: string,
    ctx: RequestContext = {},
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.activityLog.create({
        data: {
          userId,
          action,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          metadata: metadata as object,
        },
      });
    } catch {
      // Logging must never break the request path.
    }
  }

  async listForUser(userId: string, take = 50) {
    return this.prisma.activityLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }
}
