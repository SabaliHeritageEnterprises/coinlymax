import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { LoginStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../mail/mail.service';
import { ActivityLogService, RequestContext } from '../activity-log/activity-log.service';
import { LoginEventService } from '../activity-log/login-event.service';
import { TokensService } from './tokens.service';
import { TwoFactorService } from './two-factor.service';
import { RegisterDto, LoginDto, ResetPasswordDto } from './dto/auth.dto';

const TOKEN_EMAIL_VERIFY = 'EMAIL_VERIFY';
const TOKEN_PASSWORD_RESET = 'PASSWORD_RESET';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly tokens: TokensService,
    private readonly twoFactor: TwoFactorService,
    private readonly activity: ActivityLogService,
    private readonly loginEvents: LoginEventService,
  ) {}

  // ── Registration & email verification ──────────────────────────

  async register(dto: RegisterDto, ctx: RequestContext) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email is already registered');

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        displayName: dto.displayName,
        settings: { create: {} },
      },
    });

    await this.issueEmailVerification(user.id, user.email);
    await this.activity.record(user.id, 'REGISTER', ctx);
    await this.loginEvents.record({
      status: LoginStatus.REGISTER,
      email: user.email,
      username: user.displayName,
      userId: user.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return { id: user.id, email: user.email, message: 'Account created. Check your email to verify.' };
  }

  private async issueEmailVerification(userId: string, email: string) {
    const raw = this.tokens.generateOpaqueToken();
    await this.prisma.token.create({
      data: {
        userId,
        type: TOKEN_EMAIL_VERIFY,
        tokenHash: this.tokens.hashOpaque(raw),
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      },
    });
    await this.mail.sendVerificationEmail(email, raw);
  }

  async verifyEmail(rawToken: string) {
    const record = await this.prisma.token.findUnique({
      where: { tokenHash: this.tokens.hashOpaque(rawToken) },
    });
    if (!record || record.type !== TOKEN_EMAIL_VERIFY || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired verification link');
    }
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerified: true, emailVerifiedAt: new Date(), status: 'ACTIVE' },
      }),
      this.prisma.token.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    ]);
    return { message: 'Email verified. You can now log in.' };
  }

  // ── Login ──────────────────────────────────────────────────────

  async login(dto: LoginDto, ctx: RequestContext): Promise<AuthTokens & { twoFactorRequired?: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    // Constant-ish failure to avoid user enumeration.
    if (!user) {
      await argon2.hash('decoy'); // burn time
      await this.loginEvents.record({
        status: LoginStatus.FAILED, email: dto.email,
        ipAddress: ctx.ipAddress, userAgent: ctx.userAgent,
        metadata: { reason: 'unknown_email' },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await argon2.verify(user.passwordHash, dto.password).catch(() => false);
    if (!valid) {
      await this.activity.record(user.id, 'LOGIN_FAILED', ctx);
      await this.recordLoginEvent(LoginStatus.FAILED, user, ctx, { reason: 'bad_password' });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === 'SUSPENDED' || user.status === 'BANNED') {
      await this.recordLoginEvent(LoginStatus.FAILED, user, ctx, { reason: 'suspended' });
      throw new UnauthorizedException('Account is suspended. Contact support.');
    }
    if (!user.emailVerified) {
      throw new UnauthorizedException('Please verify your email before logging in.');
    }

    // 2FA gate
    if (user.twoFactorEnabled) {
      if (!dto.totp) {
        return { accessToken: '', refreshToken: '', twoFactorRequired: true };
      }
      const ok = this.twoFactor.verify(dto.totp, user.twoFactorSecret ?? '');
      if (!ok) {
        await this.activity.record(user.id, 'LOGIN_2FA_FAILED', ctx);
        await this.recordLoginEvent(LoginStatus.TWO_FACTOR_FAIL, user, ctx);
        throw new UnauthorizedException('Invalid 2FA code');
      }
    }

    const tokens = await this.createSession(user.id, user.email, user.role, ctx);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.activity.record(user.id, 'LOGIN', ctx);
    await this.recordLoginEvent(LoginStatus.LOGIN, user, ctx);
    return tokens;
  }

  /** Helper to record an auth event for a known user. */
  private recordLoginEvent(
    status: LoginStatus,
    user: { id: string; email: string; displayName: string | null },
    ctx: RequestContext,
    metadata?: Record<string, unknown>,
  ) {
    return this.loginEvents.record({
      status,
      email: user.email,
      username: user.displayName,
      userId: user.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata,
    });
  }

  /** Creates a device session and returns access + refresh tokens. */
  private async createSession(
    userId: string,
    email: string,
    role: string,
    ctx: RequestContext,
  ): Promise<AuthTokens> {
    const refreshToken = this.tokens.generateRefreshToken();
    const session = await this.prisma.session.create({
      data: {
        userId,
        refreshHash: await this.tokens.hashRefreshToken(refreshToken),
        userAgent: ctx.userAgent,
        ipAddress: ctx.ipAddress,
        expiresAt: this.tokens.refreshExpiry(),
      },
    });
    const accessToken = await this.tokens.signAccessToken({ sub: userId, email, role, sid: session.id });
    return { accessToken, refreshToken };
  }

  // ── Refresh (rotation) ─────────────────────────────────────────

  async refresh(rawRefresh: string, ctx: RequestContext): Promise<AuthTokens> {
    if (!rawRefresh) throw new UnauthorizedException('Missing refresh token');

    // The session id isn't in the opaque token, so we look up active sessions and
    // match the hash. For scale, sessions are indexed by user; here we accept the
    // refresh token alone and validate against non-revoked sessions.
    const candidates = await this.prisma.session.findMany({
      where: { isRevoked: false, expiresAt: { gt: new Date() } },
      include: { user: { select: { email: true, role: true, status: true } } },
      orderBy: { lastSeenAt: 'desc' },
      take: 200,
    });

    let matched: (typeof candidates)[number] | null = null;
    for (const s of candidates) {
      if (await this.tokens.verifyRefreshToken(rawRefresh, s.refreshHash)) {
        matched = s;
        break;
      }
    }
    if (!matched) throw new UnauthorizedException('Invalid refresh token');
    if (matched.user.status === 'SUSPENDED' || matched.user.status === 'BANNED') {
      throw new UnauthorizedException('Account is not active');
    }

    // Rotate: issue a new refresh token, update the same session row.
    const newRefresh = this.tokens.generateRefreshToken();
    await this.prisma.session.update({
      where: { id: matched.id },
      data: {
        refreshHash: await this.tokens.hashRefreshToken(newRefresh),
        lastSeenAt: new Date(),
        expiresAt: this.tokens.refreshExpiry(),
        ipAddress: ctx.ipAddress ?? matched.ipAddress,
        userAgent: ctx.userAgent ?? matched.userAgent,
      },
    });
    const accessToken = await this.tokens.signAccessToken({
      sub: matched.userId,
      email: matched.user.email,
      role: matched.user.role,
      sid: matched.id,
    });
    return { accessToken, refreshToken: newRefresh };
  }

  async logout(sessionId: string) {
    await this.prisma.session.updateMany({
      where: { id: sessionId },
      data: { isRevoked: true },
    });
    return { message: 'Logged out' };
  }

  // ── Password reset ─────────────────────────────────────────────

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Always return success to prevent enumeration.
    if (user) {
      const raw = this.tokens.generateOpaqueToken();
      await this.prisma.token.create({
        data: {
          userId: user.id,
          type: TOKEN_PASSWORD_RESET,
          tokenHash: this.tokens.hashOpaque(raw),
          expiresAt: new Date(Date.now() + 3600 * 1000),
        },
      });
      await this.mail.sendPasswordResetEmail(email, raw);
    }
    return { message: 'If that email exists, a reset link has been sent.' };
  }

  async resetPassword(dto: ResetPasswordDto, ctx: RequestContext) {
    const record = await this.prisma.token.findUnique({
      where: { tokenHash: this.tokens.hashOpaque(dto.token) },
    });
    if (!record || record.type !== TOKEN_PASSWORD_RESET || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset link');
    }
    const passwordHash = await argon2.hash(dto.password);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      this.prisma.token.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      // Revoke all sessions on password change.
      this.prisma.session.updateMany({ where: { userId: record.userId }, data: { isRevoked: true } }),
    ]);
    await this.activity.record(record.userId, 'PASSWORD_RESET', ctx);
    return { message: 'Password updated. Please log in again.' };
  }

  // ── Two-factor authentication ──────────────────────────────────

  async init2fa(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.twoFactorEnabled) throw new BadRequestException('2FA already enabled');

    const secret = this.twoFactor.generateSecret();
    // Store the pending secret; only flip the enabled flag after confirmation.
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: secret } });
    const { otpauthUrl, qrDataUrl } = await this.twoFactor.buildQrCode(user.email, secret);
    return { otpauthUrl, qrDataUrl };
  }

  async confirm2fa(userId: string, totp: string, ctx: RequestContext) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.twoFactorSecret) throw new BadRequestException('Start 2FA setup first');
    if (!this.twoFactor.verify(totp, user.twoFactorSecret)) {
      throw new BadRequestException('Invalid code');
    }
    const { codes, hashes } = this.twoFactor.generateRecoveryCodes();
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true, twoFactorRecovery: hashes },
    });
    await this.activity.record(userId, '2FA_ENABLED', ctx);
    return { message: '2FA enabled', recoveryCodes: codes };
  }

  async disable2fa(userId: string, totp: string, ctx: RequestContext) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.twoFactorEnabled || !user.twoFactorSecret) throw new BadRequestException('2FA not enabled');
    if (!this.twoFactor.verify(totp, user.twoFactorSecret)) throw new BadRequestException('Invalid code');

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorRecovery: [] },
    });
    await this.activity.record(userId, '2FA_DISABLED', ctx);
    return { message: '2FA disabled' };
  }
}
