import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma, NotificationType, Role, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UserGateway } from '../../realtime/user.gateway';
import {
  CreatePairDto,
  UpdatePairDto,
  BroadcastNotificationDto,
  AdminCreateUserDto,
  AdminUpdateUserDto,
  AdminUpdateSettingsDto,
  AdminResetPasswordDto,
  SendUserNotificationDto,
} from './dto/admin.dto';

/** The acting admin (from the JWT), passed by the controller. */
export interface Actor {
  id: string;
  role: Role;
}

const SAFE_USER_SELECT = {
  id: true, email: true, displayName: true, role: true, status: true,
  emailVerified: true, twoFactorEnabled: true, paperBalance: true,
  lastLoginAt: true, createdAt: true,
} as const;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly gateway: UserGateway,
  ) {}

  private audit(actorId: string, action: string, targetType?: string, targetId?: string, metadata?: object) {
    return this.prisma.adminLog.create({ data: { actorId, action, targetType, targetId, metadata } });
  }

  /**
   * RBAC for user-management actions. By design ADMIN and SUPER_ADMIN are
   * equivalent here — both have full management permissions over every user.
   * (Route access itself is already gated to ADMIN+ by the global RolesGuard.)
   * The only hard guard is "you cannot delete your own account" (in deleteUser).
   */
  private assertCanManage(_actor: Actor, _targetRole: Role, _grantingRole?: Role) {
    // No restriction: admin === super_admin for management capability.
  }

  /** Notify the user's live dashboard that their account changed. */
  private pushUpdate(userId: string, reason: string) {
    this.gateway.emitToUser(userId, 'account:update', { reason, at: new Date().toISOString() });
  }

  // ── Dashboard analytics ────────────────────────────────────────
  async analytics() {
    const since24h = new Date(Date.now() - 24 * 3600 * 1000);
    const [totalUsers, activeUsers, suspended, newUsers24h, totalTrades, trades24h, openOrders, pairs] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.count({ where: { status: 'ACTIVE' } }),
        this.prisma.user.count({ where: { status: 'SUSPENDED' } }),
        this.prisma.user.count({ where: { createdAt: { gte: since24h } } }),
        this.prisma.trade.count(),
        this.prisma.trade.count({ where: { createdAt: { gte: since24h } } }),
        this.prisma.trade.count({ where: { status: 'OPEN' } }),
        this.prisma.marketPair.count({ where: { status: 'ACTIVE' } }),
      ]);
    return {
      users: { total: totalUsers, active: activeUsers, suspended, new24h: newUsers24h },
      trades: { total: totalTrades, last24h: trades24h, openOrders },
      markets: { activePairs: pairs },
    };
  }

  // ── User listing ───────────────────────────────────────────────
  listUsers(search?: string, take = 50, skip = 0) {
    return this.prisma.user.findMany({
      where: search
        ? { OR: [{ email: { contains: search, mode: 'insensitive' } }, { displayName: { contains: search, mode: 'insensitive' } }] }
        : {},
      select: { ...SAFE_USER_SELECT },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    });
  }

  /**
   * Full read-only view of any user's dashboard — profile, settings, balance,
   * open positions, recent trades, recent activity, active devices.
   * Lets an admin "access any user's dashboard" without their credentials.
   */
  async getUserDashboard(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { ...SAFE_USER_SELECT, settings: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const [positions, recentTrades, activity, deviceCount] = await Promise.all([
      this.prisma.position.findMany({
        where: { userId, status: 'OPEN' },
        include: { pair: { select: { symbol: true, displayName: true, lastPrice: true } } },
      }),
      this.prisma.trade.findMany({
        where: { userId },
        include: { pair: { select: { symbol: true, displayName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.activityLog.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 25 }),
      this.prisma.session.count({ where: { userId, isRevoked: false, expiresAt: { gt: new Date() } } }),
    ]);

    let holdingsValue = 0;
    let unrealizedPnl = 0;
    const enrichedPositions = positions.map((p) => {
      const last = Number(p.pair.lastPrice);
      const dir = p.side === 'BUY' ? 1 : -1;
      const pnl = (last - Number(p.entryPrice)) * Number(p.quantity) * dir;
      holdingsValue += last * Number(p.quantity);
      unrealizedPnl += pnl;
      return { ...p, markPrice: last, unrealizedPnl: pnl };
    });
    const cash = Number(user.paperBalance);

    return {
      user,
      portfolio: { cashBalance: cash, holdingsValue, equity: cash + holdingsValue, unrealizedPnl },
      positions: enrichedPositions,
      recentTrades,
      activity,
      activeDevices: deviceCount,
    };
  }

  getUserActivity(userId: string, take = 100) {
    return this.prisma.activityLog.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take });
  }

  // ── Create / update / delete users ─────────────────────────────
  async createUser(actor: Actor, dto: AdminCreateUserDto) {
    this.assertCanManage(actor, dto.role ?? Role.USER, dto.role);
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email is already registered');

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: await argon2.hash(dto.password),
        displayName: dto.displayName,
        role: dto.role ?? Role.USER,
        status: dto.status ?? UserStatus.ACTIVE,
        emailVerified: true, // admin-created accounts are pre-verified
        emailVerifiedAt: new Date(),
        settings: { create: {} },
      },
      select: SAFE_USER_SELECT,
    });
    await this.audit(actor.id, 'USER_CREATED', 'USER', user.id, { email: user.email, role: user.role });
    return user;
  }

  async updateUser(actor: Actor, userId: string, dto: AdminUpdateUserDto) {
    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw new NotFoundException('User not found');
    this.assertCanManage(actor, target.role, dto.role);

    const data: Prisma.UserUpdateInput = {};
    if (dto.displayName !== undefined) data.displayName = dto.displayName;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.emailVerified !== undefined) {
      data.emailVerified = dto.emailVerified;
      data.emailVerifiedAt = dto.emailVerified ? new Date() : null;
    }
    if (dto.paperBalance !== undefined) data.paperBalance = new Prisma.Decimal(dto.paperBalance);

    const updated = await this.prisma.user.update({ where: { id: userId }, data, select: SAFE_USER_SELECT });

    // Suspending/banning kills active sessions immediately.
    if (dto.status === 'SUSPENDED' || dto.status === 'BANNED') {
      await this.prisma.session.updateMany({ where: { userId }, data: { isRevoked: true } });
    }
    await this.audit(actor.id, 'USER_UPDATED', 'USER', userId, dto as object);
    this.pushUpdate(userId, 'profile');
    return updated;
  }

  async updateUserSettings(actor: Actor, userId: string, dto: AdminUpdateSettingsDto) {
    const target = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!target) throw new NotFoundException('User not found');
    this.assertCanManage(actor, target.role);

    const settings = await this.prisma.userSettings.upsert({
      where: { userId },
      update: dto,
      create: { userId, ...dto },
    });
    await this.audit(actor.id, 'USER_SETTINGS_UPDATED', 'USER', userId, dto as object);
    this.pushUpdate(userId, 'settings');
    return settings;
  }

  async resetUserPassword(actor: Actor, userId: string, dto: AdminResetPasswordDto) {
    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw new NotFoundException('User not found');
    this.assertCanManage(actor, target.role);

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await argon2.hash(dto.newPassword) } }),
      // Force re-login everywhere after an admin password reset.
      this.prisma.session.updateMany({ where: { userId }, data: { isRevoked: true } }),
    ]);
    await this.audit(actor.id, 'USER_PASSWORD_RESET', 'USER', userId);
    if (dto.notifyUser) {
      await this.notifications.create(
        userId, NotificationType.SECURITY,
        'Your password was reset',
        'An administrator reset your password. You have been signed out of all devices. Please log in with your new password.',
      );
    }
    this.gateway.emitToUser(userId, 'account:update', { reason: 'password', at: new Date().toISOString() });
    return { message: 'Password reset. User has been signed out of all devices.' };
  }

  async deleteUser(actor: Actor, userId: string) {
    if (userId === actor.id) throw new BadRequestException('You cannot delete your own account');
    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw new NotFoundException('User not found');
    this.assertCanManage(actor, target.role);

    // Relations cascade on delete (sessions, trades, positions, settings, logs…).
    await this.prisma.user.delete({ where: { id: userId } });
    await this.audit(actor.id, 'USER_DELETED', 'USER', userId, { email: target.email });
    this.gateway.emitToUser(userId, 'account:deleted', { at: new Date().toISOString() });
    return { message: 'User account deleted' };
  }

  // ── Notifications ──────────────────────────────────────────────
  async notifyUser(actor: Actor, userId: string, dto: SendUserNotificationDto) {
    const target = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!target) throw new NotFoundException('User not found');
    await this.notifications.create(userId, dto.type ?? NotificationType.ADMIN, dto.title, dto.body);
    await this.audit(actor.id, 'NOTIFICATION_SENT', 'USER', userId, { title: dto.title });
    return { sent: 1 };
  }

  async broadcast(actor: Actor, dto: BroadcastNotificationDto) {
    const users = await this.prisma.user.findMany({ where: { status: 'ACTIVE' }, select: { id: true } });
    // Persist + push live to each connected user.
    await Promise.all(
      users.map((u) =>
        this.notifications.create(u.id, NotificationType.ADMIN, dto.title, dto.body),
      ),
    );
    await this.audit(actor.id, 'NOTIFICATION_BROADCAST', undefined, undefined, { recipients: users.length });
    return { sent: users.length };
  }

  // ── Market pair management ─────────────────────────────────────
  async createPair(actorId: string, dto: CreatePairDto) {
    const pair = await this.prisma.marketPair.create({
      data: {
        symbol: dto.symbol.toUpperCase(),
        base: dto.base.toUpperCase(),
        quote: dto.quote.toUpperCase(),
        displayName: dto.displayName,
        type: dto.type,
        lastPrice: new Prisma.Decimal(dto.lastPrice ?? 0),
        pricePrecision: dto.pricePrecision ?? 2,
        qtyPrecision: dto.qtyPrecision ?? 6,
      },
    });
    await this.audit(actorId, 'PAIR_CREATED', 'MARKET_PAIR', pair.id, { symbol: pair.symbol });
    return pair;
  }

  async updatePair(actorId: string, id: string, dto: UpdatePairDto) {
    const pair = await this.prisma.marketPair.update({ where: { id }, data: dto });
    await this.audit(actorId, 'PAIR_UPDATED', 'MARKET_PAIR', id, dto as object);
    return pair;
  }

  // ── Logs ───────────────────────────────────────────────────────
  adminLogs(take = 150) {
    return this.prisma.adminLog.findMany({
      include: { actor: { select: { email: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  activityLogs(take = 150) {
    return this.prisma.activityLog.findMany({
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }
}
