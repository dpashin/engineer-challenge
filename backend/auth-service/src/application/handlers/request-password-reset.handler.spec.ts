import { Test, TestingModule } from '@nestjs/testing';
import { RequestPasswordResetHandler } from './request-password-reset.handler';
import { RequestPasswordResetCommand } from '../commands/request-password-reset.command';
import { RequestPasswordResetResult, RequestPasswordResetError } from '../commands/request-password-reset.result';
import { UserRepository } from '../../infrastructure/repositories/user.repository';
import { ResetTokenRepository } from '../../infrastructure/repositories/reset-token.repository';
import { TokenService } from '../../infrastructure/services/token.service';
import { EmailService } from '../../infrastructure/services/email.service';
import { ResetTokenPolicyService } from '../../domain/reset-token-policy.service';

describe('RequestPasswordResetHandler', () => {
  let handler: RequestPasswordResetHandler;
  let userRepository: UserRepository;
  let resetTokenRepository: ResetTokenRepository;
  let tokenService: TokenService;
  let emailService: EmailService;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    isActive: true,
    failedLoginAttempts: 0,
    resetRequestBlockedUntil: null,
    failedResetAttempts: 0,
    lockedUntil: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequestPasswordResetHandler,
        {
          provide: UserRepository,
          useValue: {
            findByEmail: jest.fn(),
            unblockResetRequests: jest.fn(),
          },
        },
        {
          provide: ResetTokenRepository,
          useValue: {
            invalidateAllUserTokens: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: TokenService,
          useValue: {
            generateSecureToken: jest.fn(),
            hashToken: jest.fn(),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendPasswordResetEmail: jest.fn(),
          },
        },
      ],
    }).compile();

    handler = module.get<RequestPasswordResetHandler>(RequestPasswordResetHandler);
    userRepository = module.get<UserRepository>(UserRepository);
    resetTokenRepository = module.get<ResetTokenRepository>(ResetTokenRepository);
    tokenService = module.get<TokenService>(TokenService);
    emailService = module.get<EmailService>(EmailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should return success when user not found (prevent enumeration)', async () => {
      jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(null);

      const command = new RequestPasswordResetCommand('nonexistent@example.com', '192.168.1.1');
      const result = await handler.execute(command);

      expect(result.success).toBe(true);
      expect(userRepository.findByEmail).toHaveBeenCalledWith('nonexistent@example.com');
    });

    it('should return error when user is blocked', async () => {
      const blockedUser = {
        ...mockUser,
        resetRequestBlockedUntil: new Date(Date.now() + 1800000), // Blocked for 30 min
      };

      jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(blockedUser);

      const command = new RequestPasswordResetCommand('test@example.com', '192.168.1.1');
      const result = await handler.execute(command);

      expect(result.success).toBe(false);
      expect(result.error).toBe(RequestPasswordResetError.RATE_LIMITED);
    });

    it('should unblock user when block expired', async () => {
      const expiredBlockUser = {
        ...mockUser,
        resetRequestBlockedUntil: new Date(Date.now() - 1000), // Block expired
      };

      jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(expiredBlockUser);
      jest.spyOn(tokenService, 'generateSecureToken').mockReturnValue('reset-token-123');
      jest.spyOn(tokenService, 'hashToken').mockResolvedValue('hashed-token');
      jest.spyOn(ResetTokenPolicyService, 'getTokenExpirationDate').mockReturnValue(new Date(Date.now() + 600000));
      jest.spyOn(resetTokenRepository, 'create').mockResolvedValue();
      jest.spyOn(emailService, 'sendPasswordResetEmail').mockResolvedValue();

      const command = new RequestPasswordResetCommand('test@example.com', '192.168.1.1');
      await handler.execute(command);

      expect(userRepository.unblockResetRequests).toHaveBeenCalledWith('user-123');
    });

    it('should invalidate existing tokens before creating new one', async () => {
      jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(mockUser);
      jest.spyOn(tokenService, 'generateSecureToken').mockReturnValue('reset-token-123');
      jest.spyOn(tokenService, 'hashToken').mockResolvedValue('hashed-token');
      jest.spyOn(ResetTokenPolicyService, 'getTokenExpirationDate').mockReturnValue(new Date(Date.now() + 600000));
      jest.spyOn(resetTokenRepository, 'create').mockResolvedValue();
      jest.spyOn(emailService, 'sendPasswordResetEmail').mockResolvedValue();

      const command = new RequestPasswordResetCommand('test@example.com', '192.168.1.1');
      await handler.execute(command);

      expect(resetTokenRepository.invalidateAllUserTokens).toHaveBeenCalledWith('user-123');
      expect(resetTokenRepository.create).toHaveBeenCalled();
    });

    it('should generate and store new reset token', async () => {
      jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(mockUser);
      jest.spyOn(tokenService, 'generateSecureToken').mockReturnValue('reset-token-123');
      jest.spyOn(tokenService, 'hashToken').mockResolvedValue('hashed-token');
      const mockExpiresAt = new Date(Date.now() + 600000);
      jest.spyOn(ResetTokenPolicyService, 'getTokenExpirationDate').mockReturnValue(mockExpiresAt);
      jest.spyOn(resetTokenRepository, 'create').mockResolvedValue();
      jest.spyOn(emailService, 'sendPasswordResetEmail').mockResolvedValue();

      const command = new RequestPasswordResetCommand('test@example.com', '192.168.1.1');
      await handler.execute(command);

      expect(tokenService.generateSecureToken).toHaveBeenCalled();
      expect(tokenService.hashToken).toHaveBeenCalledWith('reset-token-123');
      expect(resetTokenRepository.create).toHaveBeenCalledWith(
        'user-123',
        'hashed-token',
        mockExpiresAt,
      );
    });

    it('should send password reset email', async () => {
      jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(mockUser);
      jest.spyOn(tokenService, 'generateSecureToken').mockReturnValue('reset-token-123');
      jest.spyOn(tokenService, 'hashToken').mockResolvedValue('hashed-token');
      jest.spyOn(ResetTokenPolicyService, 'getTokenExpirationDate').mockReturnValue(new Date(Date.now() + 600000));
      jest.spyOn(resetTokenRepository, 'create').mockResolvedValue();
      jest.spyOn(emailService, 'sendPasswordResetEmail').mockResolvedValue();

      const command = new RequestPasswordResetCommand('test@example.com', '192.168.1.1');
      await handler.execute(command);

      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        'test@example.com',
        'reset-token-123',
      );
    });

    it('should return success with token on successful reset request', async () => {
      jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(mockUser);
      jest.spyOn(tokenService, 'generateSecureToken').mockReturnValue('reset-token-123');
      jest.spyOn(tokenService, 'hashToken').mockResolvedValue('hashed-token');
      jest.spyOn(ResetTokenPolicyService, 'getTokenExpirationDate').mockReturnValue(new Date(Date.now() + 600000));
      jest.spyOn(resetTokenRepository, 'create').mockResolvedValue();
      jest.spyOn(emailService, 'sendPasswordResetEmail').mockResolvedValue();

      const command = new RequestPasswordResetCommand('test@example.com', '192.168.1.1');
      const result = await handler.execute(command);

      expect(result.success).toBe(true);
      expect(result.token).toBe('reset-token-123');
    });

    it('should return internal error on exception', async () => {
      jest.spyOn(userRepository, 'findByEmail').mockRejectedValue(new Error('Database error'));

      const command = new RequestPasswordResetCommand('test@example.com', '192.168.1.1');
      const result = await handler.execute(command);

      expect(result.success).toBe(false);
      expect(result.error).toBe(RequestPasswordResetError.INTERNAL_ERROR);
    });
  });
});
