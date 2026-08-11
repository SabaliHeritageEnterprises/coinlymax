import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Active devices for the account (current session flagged). */
  async listDevices(userId: string, currentSessionId: string) {
    const sessions = await this.prisma.session.findMany({
      where: { userId, isRevoked: false, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: 'desc' },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        deviceLabel: true,
        createdAt: true,
        lastSeenAt: true,
      },
    });
    return sessions.map((s) => ({ ...s, current: s.id === currentSessionId }));
  }

  async revoke(userId: string, sessionId: string) {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== userId) {
      throw new ForbiddenException('Session not found');
    }
    await this.prisma.session.update({ where: { id: sessionId }, data: { isRevoked: true } });
    return { message: 'Device signed out' };
  }

  /** Sign out everywhere except the current session. */
  async revokeOthers(userId: string, currentSessionId: string) {
    await this.prisma.session.updateMany({
      where: { userId, id: { not: currentSessionId }, isRevoked: false },
      data: { isRevoked: true },
    });
    return { message: 'All other devices signed out' };
  }
}
