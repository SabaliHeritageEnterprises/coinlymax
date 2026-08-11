import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { randomBytes, createHash } from 'crypto';
import { JwtPayload } from './strategies/jwt.strategy';

/**
 * Issues signed access tokens and opaque refresh tokens.
 * Refresh tokens are random secrets; only their hash is stored on the session row.
 */
@Injectable()
export class TokensService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async signAccessToken(payload: JwtPayload): Promise<string> {
    return this.jwt.signAsync(payload, {
      secret: this.config.get<string>('jwt.accessSecret'),
      expiresIn: this.config.get<number>('jwt.accessTtl'),
    });
  }

  /** Returns the raw refresh token (sent to client) — store only its hash. */
  generateRefreshToken(): string {
    return randomBytes(48).toString('hex');
  }

  async hashRefreshToken(token: string): Promise<string> {
    return argon2.hash(token);
  }

  async verifyRefreshToken(token: string, hash: string): Promise<boolean> {
    return argon2.verify(hash, token).catch(() => false);
  }

  refreshExpiry(): Date {
    const ttl = this.config.get<number>('jwt.refreshTtl')!;
    return new Date(Date.now() + ttl * 1000);
  }

  /** One-way hash for email/reset tokens stored in DB (lookup by hash). */
  hashOpaque(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  generateOpaqueToken(): string {
    return randomBytes(32).toString('hex');
  }
}
