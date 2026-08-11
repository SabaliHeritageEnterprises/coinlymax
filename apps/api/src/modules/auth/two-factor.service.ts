import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { randomBytes, createHash } from 'crypto';

/** TOTP-based two-factor authentication (compatible with Google Authenticator, Authy, etc.). */
@Injectable()
export class TwoFactorService {
  constructor(private readonly config: ConfigService) {}

  generateSecret(): string {
    return authenticator.generateSecret();
  }

  /** Builds an otpauth:// URI and renders it to a data-URL QR code for enrolment. */
  async buildQrCode(email: string, secret: string): Promise<{ otpauthUrl: string; qrDataUrl: string }> {
    const issuer = this.config.get<string>('totp.issuer')!;
    const otpauthUrl = authenticator.keyuri(email, issuer, secret);
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);
    return { otpauthUrl, qrDataUrl };
  }

  verify(token: string, secret: string): boolean {
    return authenticator.verify({ token, secret });
  }

  /** Generates plaintext recovery codes (shown once) plus their hashes (stored). */
  generateRecoveryCodes(count = 8): { codes: string[]; hashes: string[] } {
    const codes: string[] = [];
    const hashes: string[] = [];
    for (let i = 0; i < count; i++) {
      const code = randomBytes(5).toString('hex').toUpperCase().match(/.{1,5}/g)!.join('-');
      codes.push(code);
      hashes.push(this.hashCode(code));
    }
    return { codes, hashes };
  }

  hashCode(code: string): string {
    return createHash('sha256').update(code.replace(/-/g, '').toUpperCase()).digest('hex');
  }
}
