import { Test, TestingModule } from '@nestjs/testing';
import { CommandBus } from '@nestjs/cqrs';
import { AuthResolver } from './auth.resolver';
import { HealthService } from '../../infrastructure/services/health.service';
import { RegisterCommand } from '../../application/commands/register.command';
import { LoginCommand } from '../../application/commands/login.command';
import { RequestPasswordResetCommand } from '../../application/commands/request-password-reset.command';
import { ResetPasswordCommand } from '../../application/commands/reset-password.command';
import { RefreshTokenCommand } from '../../application/commands/refresh-token.command';
import { RevokeTokensCommand } from '../../application/commands/revoke-tokens.command';
import { GetUserQuery } from '../../application/queries/get-user.query';
import { RegisterErrorCode } from '../dto/register.dto';
import { LoginErrorCode } from '../dto/login.dto';
import { RequestPasswordResetErrorCode } from '../dto/request-password-reset.dto';
import { ResetPasswordErrorCode } from '../dto/reset-password.dto';
import { RefreshTokenErrorCode } from '../dto/refresh-token.dto';

describe('AuthResolver', () => {
  let resolver: AuthResolver;
  let commandBus: CommandBus;
  let healthService: HealthService;

  const mockCommandBus = {
    execute: jest.fn(),
  };

  const mockHealthService = {
    checkHealth: jest.fn(),
  };

  const mockContext = {
    req: {
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'Mozilla/5.0',
        'x-forwarded-for': '127.0.0.1',
      },
      cookies: {},
      app: {
        get: jest.fn(),
      },
    },
    res: {
      setAuthCookies: jest.fn(),
      clearAuthCookies: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthResolver,
        {
          provide: CommandBus,
          useValue: mockCommandBus,
        },
        {
          provide: HealthService,
          useValue: mockHealthService,
        },
      ],
    }).compile();

    resolver = module.get<AuthResolver>(AuthResolver);
    commandBus = module.get<CommandBus>(CommandBus);
    healthService = module.get<HealthService>(HealthService);

    jest.clearAllMocks();
  });

  describe('health', () => {
    it('should return ok string', () => {
      const result = resolver.health();
      expect(result).toBe('ok');
    });
  });

  describe('healthCheck', () => {
    it('should return health check result', async () => {
      const mockHealth = {
        status: 'healthy' as const,
        database: { status: 'healthy' as const },
        redis: { status: 'healthy' as const },
        uptime: 100,
        timestamp: new Date().toISOString(),
      };

      mockHealthService.checkHealth.mockResolvedValue(mockHealth);

      const result = await resolver.healthCheck();

      expect(healthService.checkHealth).toHaveBeenCalled();
      expect(result).toEqual(mockHealth);
    });
  });

  describe('register', () => {
    const email = 'test@example.com';
    const password = 'SecurePass123!';

    it('should register user successfully', async () => {
      const mockResult = {
        success: true,
        userId: 'user-123',
        email,
      };

      mockCommandBus.execute.mockResolvedValue(mockResult);

      const result = await resolver.register(email, password, mockContext);

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.any(RegisterCommand),
      );
      expect(result).toEqual({
        success: true,
        userId: 'user-123',
        email,
      });
    });

    it('should return error when email already exists', async () => {
      const mockResult = {
        success: false,
        error: RegisterErrorCode.EMAIL_ALREADY_EXISTS,
      };

      mockCommandBus.execute.mockResolvedValue(mockResult);

      const result = await resolver.register(email, password, mockContext);

      expect(result).toEqual({
        success: false,
        error: {
          code: RegisterErrorCode.EMAIL_ALREADY_EXISTS,
          message: 'An account with this email already exists.',
        },
      });
    });

    it('should return error when password is invalid', async () => {
      const mockResult = {
        success: false,
        error: RegisterErrorCode.INVALID_PASSWORD,
      };

      mockCommandBus.execute.mockResolvedValue(mockResult);

      const result = await resolver.register(email, password, mockContext);

      expect(result).toEqual({
        success: false,
        error: {
          code: RegisterErrorCode.INVALID_PASSWORD,
          message: expect.stringContaining('Password does not meet security requirements'),
        },
      });
    });

    it('should return error on internal error', async () => {
      const mockResult = {
        success: false,
        error: RegisterErrorCode.INTERNAL_ERROR,
      };

      mockCommandBus.execute.mockResolvedValue(mockResult);

      const result = await resolver.register(email, password, mockContext);

      expect(result).toEqual({
        success: false,
        error: {
          code: RegisterErrorCode.INTERNAL_ERROR,
          message: 'An unexpected error occurred. Please try again later.',
        },
      });
    });
  });

  describe('login', () => {
    const email = 'test@example.com';
    const password = 'SecurePass123!';

    it('should login successfully and set cookies', async () => {
      const mockResult = {
        success: true,
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
        expiresIn: 3600,
      };

      mockCommandBus.execute.mockResolvedValue(mockResult);

      const result = await resolver.login(email, password, mockContext);

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.any(LoginCommand),
      );
      expect(mockContext.res.setAuthCookies).toHaveBeenCalledWith(
        'access-token-123',
        'refresh-token-123',
      );
      expect(result).toEqual({
        success: true,
        expiresIn: 3600,
      });
    });

    it('should return error when user not found', async () => {
      const mockResult = {
        success: false,
        error: LoginErrorCode.USER_NOT_FOUND,
      };

      mockCommandBus.execute.mockResolvedValue(mockResult);

      const result = await resolver.login(email, password, mockContext);

      expect(result).toEqual({
        success: false,
        error: {
          code: LoginErrorCode.USER_NOT_FOUND,
          message: 'Invalid email or password.',
        },
      });
    });

    it('should return error when password is invalid', async () => {
      const mockResult = {
        success: false,
        error: LoginErrorCode.INVALID_PASSWORD,
      };

      mockCommandBus.execute.mockResolvedValue(mockResult);

      const result = await resolver.login(email, password, mockContext);

      expect(result).toEqual({
        success: false,
        error: {
          code: LoginErrorCode.INVALID_PASSWORD,
          message: 'Invalid email or password.',
        },
      });
    });

    it('should return error when account is locked', async () => {
      const mockResult = {
        success: false,
        error: LoginErrorCode.ACCOUNT_LOCKED,
      };

      mockCommandBus.execute.mockResolvedValue(mockResult);

      const result = await resolver.login(email, password, mockContext);

      expect(result).toEqual({
        success: false,
        error: {
          code: LoginErrorCode.ACCOUNT_LOCKED,
          message: 'Account is locked. Please contact support.',
        },
      });
    });

    it('should handle missing response object', async () => {
      const mockResult = {
        success: true,
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
        expiresIn: 3600,
      };

      mockCommandBus.execute.mockResolvedValue(mockResult);

      const contextWithoutRes = { req: mockContext.req };
      const result = await resolver.login(email, password, contextWithoutRes);

      expect(result).toEqual({
        success: true,
        expiresIn: 3600,
      });
    });
  });

  describe('requestPasswordReset', () => {
    const email = 'test@example.com';

    it('should request password reset successfully', async () => {
      const mockResult = {
        success: true,
        token: 'reset-token-123',
      };

      mockCommandBus.execute.mockResolvedValue(mockResult);

      const result = await resolver.requestPasswordReset(email, mockContext);

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.any(RequestPasswordResetCommand),
      );
      // Token should not be returned in production
      expect(result).toEqual({
        success: true,
      });
    });

    it('should return error when rate limited', async () => {
      const mockResult = {
        success: false,
        error: RequestPasswordResetErrorCode.RATE_LIMITED,
      };

      mockCommandBus.execute.mockResolvedValue(mockResult);

      const result = await resolver.requestPasswordReset(email, mockContext);

      expect(result).toEqual({
        success: false,
        error: {
          code: RequestPasswordResetErrorCode.RATE_LIMITED,
          message: 'Too many attempts. Please try again later.',
        },
      });
    });

    it('should return success even when user not found (prevent enumeration)', async () => {
      const mockResult = {
        success: true,
      };

      mockCommandBus.execute.mockResolvedValue(mockResult);

      const result = await resolver.requestPasswordReset('nonexistent@example.com', mockContext);

      expect(result).toEqual({
        success: true,
      });
    });
  });

  describe('resetPassword', () => {
    const token = 'reset-token-123';
    const newPassword = 'NewSecurePass123!';

    it('should reset password successfully', async () => {
      const mockResult = {
        success: true,
      };

      mockCommandBus.execute.mockResolvedValue(mockResult);

      const result = await resolver.resetPassword(token, newPassword);

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.any(ResetPasswordCommand),
      );
      expect(result).toEqual({
        success: true,
      });
    });

    it('should return error when token is invalid', async () => {
      const mockResult = {
        success: false,
        error: ResetPasswordErrorCode.INVALID_TOKEN,
      };

      mockCommandBus.execute.mockResolvedValue(mockResult);

      const result = await resolver.resetPassword(token, newPassword);

      expect(result).toEqual({
        success: false,
        error: {
          code: ResetPasswordErrorCode.INVALID_TOKEN,
          message: 'Invalid or revoked reset token.',
        },
      });
    });

    it('should return error when token is expired', async () => {
      const mockResult = {
        success: false,
        error: ResetPasswordErrorCode.TOKEN_EXPIRED,
      };

      mockCommandBus.execute.mockResolvedValue(mockResult);

      const result = await resolver.resetPassword(token, newPassword);

      expect(result).toEqual({
        success: false,
        error: {
          code: ResetPasswordErrorCode.TOKEN_EXPIRED,
          message: 'Reset token has expired. Please request a new one.',
        },
      });
    });

    it('should return error when token already used', async () => {
      const mockResult = {
        success: false,
        error: ResetPasswordErrorCode.TOKEN_ALREADY_USED,
      };

      mockCommandBus.execute.mockResolvedValue(mockResult);

      const result = await resolver.resetPassword(token, newPassword);

      expect(result).toEqual({
        success: false,
        error: {
          code: ResetPasswordErrorCode.TOKEN_ALREADY_USED,
          message: 'This reset token has already been used.',
        },
      });
    });

    it('should return error when new password is invalid', async () => {
      const mockResult = {
        success: false,
        error: ResetPasswordErrorCode.INVALID_PASSWORD,
      };

      mockCommandBus.execute.mockResolvedValue(mockResult);

      const result = await resolver.resetPassword(token, 'weak');

      expect(result).toEqual({
        success: false,
        error: {
          code: ResetPasswordErrorCode.INVALID_PASSWORD,
          message: 'New password does not meet security requirements.',
        },
      });
    });
  });

  describe('refreshToken', () => {
    const refreshToken = 'refresh-token-123';

    it('should refresh token successfully and set cookies', async () => {
      const mockResult = {
        success: true,
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 3600,
      };

      mockCommandBus.execute.mockResolvedValue(mockResult);

      const result = await resolver.refreshToken(refreshToken, mockContext);

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.any(RefreshTokenCommand),
      );
      expect(mockContext.res.setAuthCookies).toHaveBeenCalledWith(
        'new-access-token',
        'new-refresh-token',
      );
      expect(result).toEqual({
        success: true,
        expiresIn: 3600,
      });
    });

    it('should get refresh token from cookies if not provided', async () => {
      const mockResult = {
        success: true,
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 3600,
      };

      mockCommandBus.execute.mockResolvedValue(mockResult);

      const contextWithCookies = {
        ...mockContext,
        req: {
          ...mockContext.req,
          cookies: { refresh_token: 'cookie-refresh-token' },
        },
      };

      const result = await resolver.refreshToken(null, contextWithCookies);

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          refreshToken: 'cookie-refresh-token',
        }),
      );
      expect(result).toEqual({
        success: true,
        expiresIn: 3600,
      });
    });

    it('should return error when refresh token not provided', async () => {
      const contextWithoutToken = {
        ...mockContext,
        req: {
          ...mockContext.req,
          cookies: {},
        },
      };

      const result = await resolver.refreshToken(null, contextWithoutToken);

      expect(result).toEqual({
        success: false,
        error: {
          code: RefreshTokenErrorCode.INVALID_TOKEN,
          message: 'Refresh token not provided',
        },
      });
    });

    it('should return error when token is invalid', async () => {
      const mockResult = {
        success: false,
        error: RefreshTokenErrorCode.INVALID_TOKEN,
      };

      mockCommandBus.execute.mockResolvedValue(mockResult);

      const result = await resolver.refreshToken(refreshToken, mockContext);

      expect(result).toEqual({
        success: false,
        error: {
          code: RefreshTokenErrorCode.INVALID_TOKEN,
          message: 'Invalid refresh token.',
        },
      });
    });

    it('should return error when token is expired', async () => {
      const mockResult = {
        success: false,
        error: RefreshTokenErrorCode.TOKEN_EXPIRED,
      };

      mockCommandBus.execute.mockResolvedValue(mockResult);

      const result = await resolver.refreshToken(refreshToken, mockContext);

      expect(result).toEqual({
        success: false,
        error: {
          code: RefreshTokenErrorCode.TOKEN_EXPIRED,
          message: 'Refresh token has expired. Please login again.',
        },
      });
    });

    it('should return error when token is revoked', async () => {
      const mockResult = {
        success: false,
        error: RefreshTokenErrorCode.TOKEN_REVOKED,
      };

      mockCommandBus.execute.mockResolvedValue(mockResult);

      const result = await resolver.refreshToken(refreshToken, mockContext);

      expect(result).toEqual({
        success: false,
        error: {
          code: RefreshTokenErrorCode.TOKEN_REVOKED,
          message: 'Refresh token has been revoked. Please login again.',
        },
      });
    });

    it('should return error when user not found', async () => {
      const mockResult = {
        success: false,
        error: RefreshTokenErrorCode.USER_NOT_FOUND,
      };

      mockCommandBus.execute.mockResolvedValue(mockResult);

      const result = await resolver.refreshToken(refreshToken, mockContext);

      expect(result).toEqual({
        success: false,
        error: {
          code: RefreshTokenErrorCode.USER_NOT_FOUND,
          message: 'User not found. Please login again.',
        },
      });
    });

    it('should return error when rate limited', async () => {
      const mockResult = {
        success: false,
        error: RefreshTokenErrorCode.RATE_LIMITED,
      };

      mockCommandBus.execute.mockResolvedValue(mockResult);

      const result = await resolver.refreshToken(refreshToken, mockContext);

      expect(result).toEqual({
        success: false,
        error: {
          code: RefreshTokenErrorCode.RATE_LIMITED,
          message: 'Too many requests. Please try again later.',
        },
      });
    });
  });

  describe('logout', () => {
    const refreshToken = 'refresh-token-123';
    const userId = 'user-123';

    it('should logout successfully', async () => {
      const mockResult = {
        success: true,
        revokedCount: 1,
      };

      mockCommandBus.execute.mockResolvedValue(mockResult);

      const result = await resolver.logout(refreshToken, userId, mockContext);

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.any(RevokeTokensCommand),
      );
      expect(mockContext.res.clearAuthCookies).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        revokedCount: 1,
      });
    });

    it('should get refresh token from cookies if not provided', async () => {
      const mockResult = {
        success: true,
        revokedCount: 1,
      };

      mockCommandBus.execute.mockResolvedValue(mockResult);

      const contextWithCookies = {
        ...mockContext,
        req: {
          ...mockContext.req,
          cookies: { refresh_token: 'cookie-refresh-token' },
        },
      };

      const result = await resolver.logout(null, null, contextWithCookies);

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          refreshToken: 'cookie-refresh-token',
        }),
      );
      expect(result).toEqual({
        success: true,
        revokedCount: 1,
      });
    });

    it('should handle logout failure', async () => {
      const mockResult = {
        success: false,
        revokedCount: 0,
      };

      mockCommandBus.execute.mockResolvedValue(mockResult);

      const result = await resolver.logout(refreshToken, userId, mockContext);

      expect(result).toEqual({
        success: false,
        revokedCount: 0,
      });
    });
  });

  describe('getUser', () => {
    const userId = 'user-123';

    it('should get user successfully', async () => {
      const mockResult = {
        found: true,
        user: {
          id: userId,
          email: 'test@example.com',
          isActive: true,
          createdAt: new Date('2024-01-01'),
        },
      };

      mockCommandBus.execute.mockResolvedValue(mockResult);

      const result = await resolver.getUser(userId);

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.any(GetUserQuery),
      );
      expect(result).toEqual({
        found: true,
        user: {
          id: userId,
          email: 'test@example.com',
          isActive: true,
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      });
    });

    it('should return not found when user does not exist', async () => {
      const mockResult = {
        found: false,
      };

      mockCommandBus.execute.mockResolvedValue(mockResult);

      const result = await resolver.getUser('non-existent-user');

      expect(result).toEqual({
        found: false,
      });
    });
  });

  describe('getClientIp', () => {
    it('should extract IP from req.ip', () => {
      const context = {
        req: {
          ip: '192.168.1.1',
          headers: {},
        },
      };

      // Accessing private method through prototype for testing
      const result = (resolver as any).getClientIp(context);
      expect(result).toBe('192.168.1.1');
    });

    it('should extract IP from x-forwarded-for header', () => {
      const context = {
        req: {
          headers: {
            'x-forwarded-for': '192.168.1.1, 10.0.0.1',
          },
        },
      };

      const result = (resolver as any).getClientIp(context);
      expect(result).toBe('192.168.1.1');
    });
  });

  describe('getUserAgent', () => {
    it('should extract user agent from headers', () => {
      const context = {
        req: {
          headers: {
            'user-agent': 'Mozilla/5.0 Test Browser',
          },
        },
      };

      const result = (resolver as any).getUserAgent(context);
      expect(result).toBe('Mozilla/5.0 Test Browser');
    });
  });
});
