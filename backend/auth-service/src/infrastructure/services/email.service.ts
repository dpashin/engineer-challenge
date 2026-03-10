import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly fromAddress: string;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST', 'mailcatcher');
    const port = this.configService.get<number>('SMTP_PORT', 1025);
    this.fromAddress = this.configService.get<string>('SMTP_FROM', 'noreply@auth-service.local');

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: false,
      auth: false,
    } as nodemailer.TransportOptions);
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const resetUrl = `http://localhost:4200/set-password?token=${token}`;

    const mailOptions: nodemailer.SendMailOptions = {
      from: this.fromAddress,
      to,
      subject: 'Сброс пароля',
      html: `
        <h1>Сброс пароля</h1>
        <p>Вы запросили сброс пароля. Нажмите на ссылку ниже, чтобы установить новый пароль:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>Если вы не запрашивали сброс пароля, проигнорируйте это письмо.</p>
        <p>Ссылка действительна в течение 1 часа.</p>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Password reset email sent to: ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${to}: ${error.message}`);
      throw error;
    }
  }
}
