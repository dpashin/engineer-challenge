import { Test, TestingModule } from '@nestjs/testing';
import { LoginHandler } from './login.handler';
import { LoginCommand } from '../commands/login.command';
import { LoginResult, LoginError } from '../commands/login.result';
import { UserRepository } from '../../infrastructure/repositories/user.repository';
import { PasswordHasher } from '../../infrastructure/services/password-hasher.service';
import { TokenService } from '../../infrastructure/services/token.service';
import { RefreshTokenRepository } from '../../infrastructure/repositories/refresh-token.repository';
import { RateLimitService, RateLimitType } from '../../infrastructure/services/rate-limit';
import { AccountLockoutService, LockoutStatus } from '../../infrastructure/services/account-lockout.service';

describe('LoginHandler', () => {
  let handler: LoginHandler;
  let userRepository: UserRepository;
  let passwordHasher: PasswordHasher;
  let tokenService: TokenService;
  let refreshTokenRepository: RefreshTokenRepository;
  let rateLimitService: RateLimitService;
  let accountLockoutService: AccountLockoutService;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    isActive: true,
    lockedUntil: null,
    failedLoginAttempts: 0,
    resetRequestBlockedUntil: null,
    failedResetAttempts: 0,
  };

  const mockRateLimitResult = {
    allowed: true,
    remaining: 5,
    resetAt: Date.now() + 3600000,
  };

  const mockLockoutStatus: LockoutStatus = {
    isLocked: false,
    lockedUntil: null,
    remainingLockoutSeconds: 0,
    failedAttempts: 0,
    shouldApplyDelay: false,
    delayMs: 0,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoginHandler,
        {
          provide: UserRepository,
          useValue: {
            findByEmail: jest.fn(),
            resetFailedLogins: jest.fn(),
          },
        },
        {
          provide: PasswordHasher,
          useValue: {
            compare: jest.fn(),
          },
        },
        {
          provide: TokenService,
          useValue: {
            generateAccessToken: jest.fn(),
            generateRefreshToken: jest.fn(),
            hashToken: jest.fn(),
          },
        },
        {
          provide: RefreshTokenRepository,
          useValue: {
            create: jest.fn(),
          },
        },
        {
          provide: RateLimitService,
          useValue: {
            checkLimitByType: jest.fn(),
          },
        },
        {
          provide: AccountLockoutService,
          useValue: {
            checkLockoutStatus: jest.fn(),
            handleFailedLogin: jest.fn(),
            handleSuccessfulLogin: jest.fn(),
            applyProgressiveDelay: jest.fn(),
          },
        },
      ],
    }).compile();

    handler = module.get<LoginHandler>(LoginHandler);
    userRepository = module.get<UserRepository>(UserRepository);
    passwordHasher = module.get<PasswordHasher>(PasswordHasher);
    tokenService = module.get<TokenService>(TokenService);
    refreshTokenRepository = module.get<RefreshTokenRepository>(RefreshTokenRepository);
    rateLimitService = module.get<RateLimitService>(RateLimitService);
    accountLockoutService = module.get<AccountLockoutService>(AccountLockoutService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Rate Limiting', () => {
    it('should reject login when rate limit exceeded by email', async () => {
      jest.spyOn(rateLimitService, 'checkLimitByType').mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 1800000,
        retryAfter: 1800,
      });

      const command = new LoginCommand('test@example.com', 'password123');
      const result = await handler.execute(command);

      expect(result.success).toBe(false);
      expect(result.error).toBe(LoginError.ACCOUNT_LOCKED);
      expect(result.retryAfter).toBe(1800);
      expect(rateLimitService.checkLimitByType).toHaveBeenCalledWith(
        RateLimitType.LOGIN_BY_EMAIL,
        'test@example.com',
      );
    });

    it('should reject login when rate limit exceeded by IP', async () => {
      jest.spyOn(rateLimitService, 'checkLimitByType')
        .mockResolvedValueOnce(mockRateLimitResult) // email check passes
        .mockResolvedValueOnce({
          allowed: false,
          remaining: 0,
          resetAt: Date.now() + 900000,
          retryAfter: 900,
        }); // IP check fails

      const command = new LoginCommand('test@example.com', 'password123', '192.168.1.1');
      const result = await handler.execute(command);

      expect(result.success).toBe(false);
      expect(result.error).toBe(LoginError.TOO_MANY_REQUESTS);
      expect(result.retryAfter).toBe(900);
    });
  });

  describe('User Not Found', () => {
    it('should return USER_NOT_FOUND when user does not exist', async () => {
      jest.spyOn(rateLimitService, 'checkLimitByType').mockResolvedValue(mockRateLimitResult);
      jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(null);

      const command = new LoginCommand('nonexistent@example.com', 'password123');
      const result = await handler.execute(command);

      expect(result.success).toBe(false);
      expect(result.error).toBe(LoginError.USER_NOT_FOUND);
      expect(userRepository.findByEmail).toHaveBeenCalledWith('nonexistent@example.com');
    });

    it('should apply fake delay for non-existent user to prevent enumeration', async () => {
      jest.spyOn(rateLimitService, 'checkLimitByType').mockResolvedValue(mockRateLimitResult);
      jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(null);

      const command = new LoginCommand('nonexistent@example.com', 'password123');
      const startTime = Date.now();
      await handler.execute(command);
      const endTime = Date.now();

      // Fake delay should be approximately 1 second
      expect(endTime - startTime).toBeGreaterThanOrEqual(900);
    });
  });

  describe('Account Lockout', () => {
    it('should reject login when account is locked', async () => {
      const lockedUser = {
        ...mockUser,
        lockedUntil: new Date(Date.now() + 1800000), // Locked for 30 more minutes
        failedLoginAttempts: 5,
      };

      jest.spyOn(rateLimitService, 'checkLimitByType').mockResolvedValue(mockRateLimitResult);
      jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(lockedUser);
      jest.spyOn(accountLockoutService, 'checkLockoutStatus').mockResolvedValue({
        isLocked: true,
        lockedUntil: lockedUser.lockedUntil,
        remainingLockoutSeconds: 1800,
        failedAttempts: 5,
        shouldApplyDelay: false,
        delayMs: 0,
      });

      const command = new LoginCommand('test@example.com', 'password123');
      const result = await handler.execute(command);

      expect(result.success).toBe(false);
      expect(result.error).toBe(LoginError.ACCOUNT_LOCKED);
      expect(result.retryAfter).toBe(1800);
      expect(result.lockedUntil).toBeDefined();
    });

    it('should reject login when account is inactive', async () => {
      const inactiveUser = {
        ...mockUser,
        isActive: false,
      };

      jest.spyOn(rateLimitService, 'checkLimitByType').mockResolvedValue(mockRateLimitResult);
      jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(inactiveUser);

      const command = new LoginCommand('test@example.com', 'password123');
      const result = await handler.execute(command);

      expect(result.success).toBe(false);
      expect(result.error).toBe(LoginError.ACCOUNT_LOCKED);
    });
  });

  describe('Invalid Password', () => {
    it('should reject login with invalid password', async () => {
      jest.spyOn(rateLimitService, 'checkLimitByType').mockResolvedValue(mockRateLimitResult);
      jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(mockUser);
      jest.spyOn(passwordHasher, 'compare').mockResolvedValue(false);
      jest.spyOn(accountLockoutService, 'handleFailedLogin').mockResolvedValue({
        isLocked: false,
        lockedUntil: null,
        remainingLockoutSeconds: 0,
        failedAttempts: 3,
        shouldApplyDelay: true,
        delayMs: 2000,
      });

      const command = new LoginCommand('test@example.com', 'wrongpassword');
      const result = await handler.execute(command);

      expect(result.success).toBe(false);
      expect(result.error).toBe(LoginError.INVALID_PASSWORD);
      expect(result.failedAttempts).toBe(3);
      expect(accountLockoutService.handleFailedLogin).toHaveBeenCalledWith('user-123', 'test@example.com');
    });

    it('should handle account lockout after max failed attempts', async () => {
      jest.spyOn(rateLimitService, 'checkLimitByType').mockResolvedValue(mockRateLimitResult);
      jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(mockUser);
      jest.spyOn(passwordHasher, 'compare').mockResolvedValue(false);
      jest.spyOn(accountLockoutService, 'handleFailedLogin').mockResolvedValue({
        isLocked: true,
        lockedUntil: new Date(Date.now() + 1800000),
        remainingLockoutSeconds: 1800,
        failedAttempts: 5,
        shouldApplyDelay: false,
        delayMs: 0,
      });

      const command = new LoginCommand('test@example.com', 'wrongpassword');
      const result = await handler.execute(command);

      expect(result.success).toBe(false);
      expect(result.error).toBe(LoginError.INVALID_PASSWORD);
      expect(result.retryAfter).toBe(1800);
      expect(result.lockedUntil).toBeDefined();
    });

    it('should apply progressive delay on failed login', async () => {
      jest.spyOn(rateLimitService, 'checkLimitByType').mockResolvedValue(mockRateLimitResult);
      jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(mockUser);
      jest.spyOn(passwordHasher, 'compare').mockResolvedValue(false);
      jest.spyOn(accountLockoutService, 'handleFailedLogin').mockResolvedValue({
        isLocked: false,
        lockedUntil: null,
        remainingLockoutSeconds: 0,
        failedAttempts: 4,
        shouldApplyDelay: true,
        delayMs: 500, // Reduced for test speed
      });
      
      // Mock applyProgressiveDelay to actually wait
      jest.spyOn(accountLockoutService, 'applyProgressiveDelay').mockImplementation((delayMs: number) => {
        return new Promise(resolve => setTimeout(resolve, delayMs));
      });

      const command = new LoginCommand('test@example.com', 'wrongpassword');
      const startTime = Date.now();
      await handler.execute(command);
      const endTime = Date.now();

      expect(accountLockoutService.applyProgressiveDelay).toHaveBeenCalledWith(500);
      expect(endTime - startTime).toBeGreaterThanOrEqual(450);
    }, 10000); // 10 second timeout
  });

  describe('Successful Login', () => {
    it('should return tokens on successful login', async () => {
      const mockAccessToken = 'access-token-123';
      const mockRefreshToken = 'refresh-token-456';
      const mockRefreshTokenData = {
        token: mockRefreshToken,
        expiresAt: new Date(Date.now() + 604800000),
        jti: 'jti-123',
      };

      jest.spyOn(rateLimitService, 'checkLimitByType').mockResolvedValue(mockRateLimitResult);
      jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(mockUser);
      jest.spyOn(passwordHasher, 'compare').mockResolvedValue(true);
      jest.spyOn(accountLockoutService, 'handleSuccessfulLogin').mockResolvedValue();
      jest.spyOn(userRepository, 'resetFailedLogins').mockResolvedValue();
      jest.spyOn(tokenService, 'generateAccessToken').mockResolvedValue(mockAccessToken);
      jest.spyOn(tokenService, 'generateRefreshToken').mockResolvedValue(mockRefreshTokenData);
      jest.spyOn(tokenService, 'hashToken').mockResolvedValue('hashed-refresh-token');
      jest.spyOn(refreshTokenRepository, 'create').mockResolvedValue();

      const command = new LoginCommand('test@example.com', 'correctpassword', '192.168.1.1', 'Mozilla/5.0');
      const result = await handler.execute(command);

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe(mockAccessToken);
      expect(result.refreshToken).toBe(mockRefreshToken);
      expect(result.expiresIn).toBe(3600);
      expect(accountLockoutService.handleSuccessfulLogin).toHaveBeenCalledWith('user-123', 'test@example.com');
      expect(userRepository.resetFailedLogins).toHaveBeenCalledWith('user-123');
      expect(refreshTokenRepository.create).toHaveBeenCalledWith(
        'user-123',
        'hashed-refresh-token',
        'jti-123',
        expect.any(Date),
        '192.168.1.1',
        'Mozilla/5.0',
      );
    });

    it('should handle login without IP and User Agent', async () => {
      const mockAccessToken = 'access-token-123';
      const mockRefreshToken = 'refresh-token-456';
      const mockRefreshTokenData = {
        token: mockRefreshToken,
        expiresAt: new Date(Date.now() + 604800000),
        jti: 'jti-123',
      };

      jest.spyOn(rateLimitService, 'checkLimitByType').mockResolvedValue(mockRateLimitResult);
      jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(mockUser);
      jest.spyOn(passwordHasher, 'compare').mockResolvedValue(true);
      jest.spyOn(accountLockoutService, 'handleSuccessfulLogin').mockResolvedValue();
      jest.spyOn(userRepository, 'resetFailedLogins').mockResolvedValue();
      jest.spyOn(tokenService, 'generateAccessToken').mockResolvedValue(mockAccessToken);
      jest.spyOn(tokenService, 'generateRefreshToken').mockResolvedValue(mockRefreshTokenData);
      jest.spyOn(tokenService, 'hashToken').mockResolvedValue('hashed-refresh-token');
      jest.spyOn(refreshTokenRepository, 'create').mockResolvedValue();

      const command = new LoginCommand('test@example.com', 'correctpassword');
      const result = await handler.execute(command);

      expect(result.success).toBe(true);
      expect(refreshTokenRepository.create).toHaveBeenCalledWith(
        'user-123',
        'hashed-refresh-token',
        'jti-123',
        expect.any(Date),
        undefined,
        undefined,
      );
    });
  });

  describe('Error Handling', () => {
    it('should return INTERNAL_ERROR on unexpected error', async () => {
      jest.spyOn(rateLimitService, 'checkLimitByType').mockRejectedValue(new Error('Database error'));

      const command = new LoginCommand('test@example.com', 'password123');
      const result = await handler.execute(command);

      expect(result.success).toBe(false);
      expect(result.error).toBe(LoginError.INTERNAL_ERROR);
    });
  });
});
