import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService, RequestContext } from '../activity-log/activity-log.service';
import { UpdateProfileDto, UpdateSettingsDto, ChangePasswordDto } from './dto/users.dto';

const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  displayName: true,
  role: true,
  status: true,
  emailVerified: true,
  twoFactorEnabled: true,
  paperBalance: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityLogService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { ...PUBLIC_USER_SELECT, settings: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { displayName: dto.displayName },
      select: PUBLIC_USER_SELECT,
    });
  }

  async updateSettings(userId: string, dto: UpdateSettingsDto) {
    return this.prisma.userSettings.upsert({
      where: { userId },
      update: dto,
      create: { userId, ...dto },
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto, ctx: RequestContext) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const ok = await argon2.verify(user.passwordHash, dto.currentPassword).catch(() => false);
    if (!ok) throw new BadRequestException('Current password is incorrect');

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await argon2.hash(dto.newPassword) },
    });
    // Revoke other sessions for safety.
    await this.prisma.session.updateMany({ where: { userId }, data: { isRevoked: true } });
    await this.activity.record(userId, 'PASSWORD_CHANGE', ctx);
    return { message: 'Password changed. Please log in again on other devices.' };
  }

  async getPortfolio(userId: string) {
    const [user, positions, openOrders] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { paperBalance: true } }),
      this.prisma.position.findMany({
        where: { userId, status: 'OPEN' },
        include: { pair: { select: { symbol: true, displayName: true, lastPrice: true } } },
      }),
      this.prisma.trade.count({ where: { userId, status: 'OPEN' } }),
    ]);

    // Mark-to-market unrealised PnL using cached last prices.
    let unrealizedPnl = 0;
    let holdingsValue = 0;
    const enriched = positions.map((p) => {
      const last = Number(p.pair.lastPrice);
      const entry = Number(p.entryPrice);
      const qty = Number(p.quantity);
      const dir = p.side === 'BUY' ? 1 : -1;
      const pnl = (last - entry) * qty * dir;
      unrealizedPnl += pnl;
      holdingsValue += last * qty;
      return { ...p, markPrice: last, unrealizedPnl: pnl };
    });

    const cash = Number(user?.paperBalance ?? 0);
    return {
      cashBalance: cash,
      holdingsValue,
      equity: cash + holdingsValue,
      unrealizedPnl,
      openOrders,
      positions: enriched,
    };
  }
}
