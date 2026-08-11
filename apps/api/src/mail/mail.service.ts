import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * Email delivery. When SMTP_HOST is empty (local dev) emails are logged to the
 * console instead of being sent — so you can grab verification/reset links without
 * configuring a real SMTP server.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('smtp.host');
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: this.config.get<number>('smtp.port'),
        secure: this.config.get<number>('smtp.port') === 465,
        auth: {
          user: this.config.get<string>('smtp.user'),
          pass: this.config.get<string>('smtp.pass'),
        },
      });
    }
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    const from = this.config.get<string>('smtp.from');
    if (!this.transporter) {
      // Surface any action links so they can be opened without a real SMTP server.
      const links = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
      const linkLine = links.length ? `\n  LINK: ${links.join('\n  LINK: ')}` : '';
      this.logger.warn(`[DEV MAIL] To: ${to} | ${subject}${linkLine}`);
      return;
    }
    await this.transporter.sendMail({ from, to, subject, html });
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const url = `${this.config.get('corsOrigin')}/auth/verify-email?token=${token}`;
    await this.send(
      to,
      'Verify your ApexTrade account',
      `<h2>Welcome to ApexTrade</h2><p>Confirm your email to activate your account:</p>
       <p><a href="${url}">Verify my email</a></p><p>This link expires in 24 hours.</p>`,
    );
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const url = `${this.config.get('corsOrigin')}/auth/reset-password?token=${token}`;
    await this.send(
      to,
      'Reset your ApexTrade password',
      `<h2>Password reset requested</h2><p>Click below to set a new password:</p>
       <p><a href="${url}">Reset password</a></p><p>If you didn't request this, ignore this email. Link expires in 1 hour.</p>`,
    );
  }

  async sendSecurityAlert(to: string, message: string): Promise<void> {
    await this.send(to, 'ApexTrade security alert', `<h2>Security alert</h2><p>${message}</p>`);
  }
}
