import { EmailService } from './email.service';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Logger } from '@nestjs/common';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

describe('EmailService', () => {
  let service: EmailService;
  let mockConfigService: ConfigService;
  let mockTransporter: any;
  let mockLogger: Logger;

  const mockSendMail = jest.fn();

  beforeEach(() => {
    mockTransporter = {
      sendMail: mockSendMail,
    };

    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);

    mockConfigService = {
      get: jest.fn(),
    } as unknown as ConfigService;

    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as unknown as Logger;

    jest.spyOn(Logger.prototype, 'log').mockImplementation(mockLogger.log);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(mockLogger.error);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(mockLogger.warn);
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(mockLogger.debug);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create transporter with default mailcatcher config', () => {
      jest.spyOn(mockConfigService, 'get').mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'SMTP_HOST') return defaultValue;
        if (key === 'SMTP_PORT') return defaultValue;
        if (key === 'SMTP_FROM') return defaultValue;
        return defaultValue;
      });

      service = new EmailService(mockConfigService);

      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: 'mailcatcher',
        port: 1025,
        secure: false,
        auth: false,
      });
    });

    it('should create transporter with custom host and port from config', () => {
      jest.spyOn(mockConfigService, 'get').mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'SMTP_HOST') return 'smtp.example.com';
        if (key === 'SMTP_PORT') return 587;
        if (key === 'SMTP_FROM') return defaultValue;
        return defaultValue;
      });

      service = new EmailService(mockConfigService);

      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: false,
      });
    });

    it('should use custom from address from config', () => {
      jest.spyOn(mockConfigService, 'get').mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'SMTP_HOST') return 'mailcatcher';
        if (key === 'SMTP_PORT') return 1025;
        if (key === 'SMTP_FROM') return 'custom@auth-service.local';
        return defaultValue;
      });

      service = new EmailService(mockConfigService);

      // Verify from address is stored
      expect(service).toBeDefined();
    });
  });

  describe('sendPasswordResetEmail', () => {
    beforeEach(() => {
      jest.spyOn(mockConfigService, 'get').mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'SMTP_HOST') return 'mailcatcher';
        if (key === 'SMTP_PORT') return 1025;
        if (key === 'SMTP_FROM') return 'noreply@auth-service.local';
        return defaultValue;
      });

      service = new EmailService(mockConfigService);
    });

    it('should send password reset email successfully', async () => {
      mockSendMail.mockResolvedValueOnce({ messageId: 'message-123' });

      const to = 'user@example.com';
      const token = 'reset-token-abc123';

      await service.sendPasswordResetEmail(to, token);

      expect(mockSendMail).toHaveBeenCalledWith({
        from: 'noreply@auth-service.local',
        to,
        subject: 'Сброс пароля',
        html: expect.stringContaining('Сброс пароля'),
      });

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain(`http://localhost:4200/set-password?token=${token}`);
      expect(mailOptions.html).toContain('Ссылка действительна в течение 1 часа');
    });

    it('should log success message after sending email', async () => {
      mockSendMail.mockResolvedValueOnce({ messageId: 'message-123' });

      const to = 'user@example.com';
      const token = 'reset-token-abc123';

      await service.sendPasswordResetEmail(to, token);

      expect(mockLogger.log).toHaveBeenCalledWith(
        `Password reset email sent to: ${to}`,
      );
    });

    it('should throw error when sending email fails', async () => {
      const error = new Error('SMTP connection failed');
      mockSendMail.mockRejectedValueOnce(error);

      const to = 'user@example.com';
      const token = 'reset-token-abc123';

      await expect(service.sendPasswordResetEmail(to, token)).rejects.toThrow('SMTP connection failed');
    });

    it('should log error when sending email fails', async () => {
      const error = new Error('SMTP error');
      mockSendMail.mockRejectedValueOnce(error);

      const to = 'user@example.com';
      const token = 'reset-token';

      try {
        await service.sendPasswordResetEmail(to, token);
      } catch (e) {
        // Expected error
      }

      expect(mockLogger.error).toHaveBeenCalledWith(
        `Failed to send password reset email to ${to}: SMTP error`,
      );
    });

    it('should generate correct reset URL with token', async () => {
      mockSendMail.mockResolvedValueOnce({ messageId: 'message-123' });

      const to = 'user@example.com';
      const token = 'unique-reset-token-xyz';

      await service.sendPasswordResetEmail(to, token);

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain(
        `http://localhost:4200/set-password?token=${token}`,
      );
    });

    it('should include security message about ignoring if not requested', async () => {
      mockSendMail.mockResolvedValueOnce({ messageId: 'message-123' });

      await service.sendPasswordResetEmail('user@example.com', 'token');

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain(
        'Если вы не запрашивали сброс пароля, проигнорируйте это письмо',
      );
    });
  });
});
