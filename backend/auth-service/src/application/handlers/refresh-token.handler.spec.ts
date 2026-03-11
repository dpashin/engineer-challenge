import { Test, TestingModule } from '@nestjs/testing';
import { RefreshTokenHandler } from './refresh-token.handler';
import { RefreshTokenCommand } from '../commands/refresh-token.command';
import { RefreshTokenResult, RefreshTokenError } from '../commands/refresh-token.result';
import { RefreshTokenRepository } from '../../infrastructure/repositories/refresh-token.repository';
import { UserRepository } from '../../infrastructure/repositories/user.repository';
import { TokenService, JwtPayload } from '../../infrastructure/services/token.service';
import { PasswordHasher } from '../../infrastructure/services/password-hasher.service';

describe('RefreshTokenHandler', () => {
  let handler: RefreshTokenHandler;
  let refreshTokenRepository: RefreshTokenRepository;
  let userRepository: UserRepository;
  let tokenService: TokenService;
  let passwordHasher: PasswordHasher;

  const mockStoredToken = {
    id: 'token-id-123',
    userId: 'user-123',
    tokenHash: 'hashed-refresh-token',
    jti: 'jti-123',
    expiresAt: new Date(Date.now() + 604800000), // 7 days
    revokedAt: null,
    lastUsedAt: null,
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
  };

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    isActive: true,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokenHandler,
        {
          provide: RefreshTokenRepository,
          useValue: {
            findByToken: jest.fn(),
            revokeAtomically: jest.fn(),
            revoke: jest.fn(),
            create: jest.fn(),
            recordUsage: jest.fn(),
            revokeAllUserTokens: jest.fn(),
          },
        },
        {
          provide: UserRepository,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: TokenService,
          useValue: {
            verifyRefreshToken: jest.fn(),
            hashToken: jest.fn(),
            generateAccessToken: jest.fn(),
            generateRefreshToken: jest.fn(),
            getAccessTokenExpiresIn: jest.fn().mockReturnValue(3600),
          },
        },
        {
          provide: PasswordHasher,
          useValue: {
            // Not used in this handler but required for DI
          },
        },
      ],
    }).compile();

    handler = module.get<RefreshTokenHandler>(RefreshTokenHandler);
    refreshTokenRepository = module.get<RefreshTokenRepository>(RefreshTokenRepository);
    userRepository = module.get<UserRepository>(UserRepository);
    tokenService = module.get<TokenService>(TokenService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should return error when token is invalid', async () => {
      jest.spyOn(tokenService, 'verifyRefreshToken').mockResolvedValue(null);

      const command = new RefreshTokenCommand('invalid-token', '192.168.1.1', 'Mozilla/5.0');
      const result = await handler.execute(command);

      expect(result.success).toBe(false);
      expect(result.error).toBe(RefreshTokenError.INVALID_TOKEN);
    });

    it('should return error when token not found in database', async () => {
      const mockPayload: JwtPayload = { sub: 'user-123', email: '', jti: 'jti-123' };
      jest.spyOn(tokenService, 'verifyRefreshToken').mockResolvedValue(mockPayload);
      jest.spyOn(tokenService, 'hashToken').mockResolvedValue('hashed-token');
      jest.spyOn(refreshTokenRepository, 'findByToken').mockResolvedValue(null);

      const command = new RefreshTokenCommand('refresh-token', '192.168.1.1', 'Mozilla/5.0');
      const result = await handler.execute(command);

      expect(result.success).toBe(false);
      expect(result.error).toBe(RefreshTokenError.INVALID_TOKEN);
    });

    it('should return error when token is expired', async () => {
      const mockPayload: JwtPayload = { sub: 'user-123', email: '', jti: 'jti-123' };
      const expiredToken = {
        ...mockStoredToken,
        expiresAt: new Date(Date.now() - 1000), // Expired
        lastUsedAt: null, // Ensure not used
      };

      jest.spyOn(tokenService, 'verifyRefreshToken').mockResolvedValue(mockPayload);
      jest.spyOn(tokenService, 'hashToken').mockResolvedValue('hashed-token');
      jest.spyOn(refreshTokenRepository, 'findByToken').mockResolvedValue(expiredToken);
      jest.spyOn(userRepository, 'findById').mockResolvedValue(mockUser);

      // Use matching IP and UserAgent
      const command = new RefreshTokenCommand('refresh-token', '192.168.1.1', 'Mozilla/5.0');
      const result = await handler.execute(command);

      expect(result.success).toBe(false);
      expect(result.error).toBe(RefreshTokenError.TOKEN_EXPIRED);
    });

    it('should return error when JTI mismatch', async () => {
      const mockPayload: JwtPayload = { sub: 'user-123', email: '', jti: 'different-jti' };
      jest.spyOn(tokenService, 'verifyRefreshToken').mockResolvedValue(mockPayload);
      jest.spyOn(tokenService, 'hashToken').mockResolvedValue('hashed-token');
      jest.spyOn(refreshTokenRepository, 'findByToken').mockResolvedValue(mockStoredToken);

      const command = new RefreshTokenCommand('refresh-token', '192.168.1.1', 'Mozilla/5.0');
      const result = await handler.execute(command);

      expect(result.success).toBe(false);
      expect(result.error).toBe(RefreshTokenError.INVALID_TOKEN);
    });

    it('should return error when IP address mismatch', async () => {
      const mockPayload: JwtPayload = { sub: 'user-123', email: '', jti: 'jti-123' };
      const storedTokenWithIp = {
        ...mockStoredToken,
        ipAddress: '192.168.1.1',
      };

      jest.spyOn(tokenService, 'verifyRefreshToken').mockResolvedValue(mockPayload);
      jest.spyOn(tokenService, 'hashToken').mockResolvedValue('hashed-token');
      jest.spyOn(refreshTokenRepository, 'findByToken').mockResolvedValue(storedTokenWithIp);

      const command = new RefreshTokenCommand('refresh-token', '10.0.0.1', 'Mozilla/5.0'); // Different IP
      const result = await handler.execute(command);

      expect(result.success).toBe(false);
      expect(result.error).toBe(RefreshTokenError.INVALID_TOKEN);
    });

    it('should return error when User Agent mismatch', async () => {
      const mockPayload: JwtPayload = { sub: 'user-123', email: '', jti: 'jti-123' };
      const storedTokenWithUA = {
        ...mockStoredToken,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      jest.spyOn(tokenService, 'verifyRefreshToken').mockResolvedValue(mockPayload);
      jest.spyOn(tokenService, 'hashToken').mockResolvedValue('hashed-token');
      jest.spyOn(refreshTokenRepository, 'findByToken').mockResolvedValue(storedTokenWithUA);

      const command = new RefreshTokenCommand('refresh-token', '192.168.1.1', 'Chrome/100.0'); // Different UA
      const result = await handler.execute(command);

      expect(result.success).toBe(false);
      expect(result.error).toBe(RefreshTokenError.INVALID_TOKEN);
    });

    it('should detect replay attack and revoke all user tokens', async () => {
      const mockPayload: JwtPayload = { sub: 'user-123', email: '', jti: 'jti-123' };
      const usedToken = {
        ...mockStoredToken,
        lastUsedAt: new Date(Date.now() - 1000), // Already used
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      jest.spyOn(tokenService, 'verifyRefreshToken').mockResolvedValue(mockPayload);
      jest.spyOn(tokenService, 'hashToken').mockResolvedValue('hashed-token');
      jest.spyOn(refreshTokenRepository, 'findByToken').mockResolvedValue(usedToken);
      jest.spyOn(refreshTokenRepository, 'revokeAllUserTokens').mockResolvedValue(5);

      const command = new RefreshTokenCommand('refresh-token', '192.168.1.1', 'Mozilla/5.0');
      const result = await handler.execute(command);

      expect(result.success).toBe(false);
      expect(result.error).toBe(RefreshTokenError.TOKEN_REVOKED);
      expect(refreshTokenRepository.revokeAllUserTokens).toHaveBeenCalledWith('user-123');
    });

    it('should return error when token is revoked', async () => {
      const mockPayload: JwtPayload = { sub: 'user-123', email: '', jti: 'jti-123' };
      const revokedToken = {
        ...mockStoredToken,
        revokedAt: new Date(Date.now() - 1000),
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      jest.spyOn(tokenService, 'verifyRefreshToken').mockResolvedValue(mockPayload);
      jest.spyOn(tokenService, 'hashToken').mockResolvedValue('hashed-token');
      jest.spyOn(refreshTokenRepository, 'findByToken').mockResolvedValue(revokedToken);

      const command = new RefreshTokenCommand('refresh-token', '192.168.1.1', 'Mozilla/5.0');
      const result = await handler.execute(command);

      expect(result.success).toBe(false);
      expect(result.error).toBe(RefreshTokenError.TOKEN_REVOKED);
    });

    it('should return error when user not found', async () => {
      const mockPayload: JwtPayload = { sub: 'non-existent-user', email: '', jti: 'jti-123' };

      jest.spyOn(tokenService, 'verifyRefreshToken').mockResolvedValue(mockPayload);
      jest.spyOn(tokenService, 'hashToken').mockResolvedValue('hashed-token');
      jest.spyOn(refreshTokenRepository, 'findByToken').mockResolvedValue(null);

      const command = new RefreshTokenCommand('refresh-token', '192.168.1.1', 'Mozilla/5.0');
      const result = await handler.execute(command);

      expect(result.success).toBe(false);
      expect(result.error).toBe(RefreshTokenError.INVALID_TOKEN);
    });

    it('should return error when user is inactive', async () => {
      const mockPayload: JwtPayload = { sub: 'user-123', email: '', jti: 'jti-123' };
      const inactiveUser = { ...mockUser, isActive: false };

      jest.spyOn(tokenService, 'verifyRefreshToken').mockResolvedValue(mockPayload);
      jest.spyOn(tokenService, 'hashToken').mockResolvedValue('hashed-token');
      jest.spyOn(refreshTokenRepository, 'findByToken').mockResolvedValue(mockStoredToken);
      jest.spyOn(userRepository, 'findById').mockResolvedValue(inactiveUser);

      const command = new RefreshTokenCommand('refresh-token', '192.168.1.1', 'Mozilla/5.0');
      const result = await handler.execute(command);

      expect(result.success).toBe(false);
      expect(result.error).toBe(RefreshTokenError.USER_NOT_FOUND);
    });

    it('should detect concurrent replay attack via atomic revocation', async () => {
      const mockPayload: JwtPayload = { sub: 'user-123', email: '', jti: 'jti-123' };

      jest.spyOn(tokenService, 'verifyRefreshToken').mockResolvedValue(mockPayload);
      jest.spyOn(tokenService, 'hashToken').mockResolvedValue('hashed-token');
      jest.spyOn(refreshTokenRepository, 'findByToken').mockResolvedValue(mockStoredToken);
      jest.spyOn(refreshTokenRepository, 'revokeAtomically').mockResolvedValue(false); // Already revoked
      jest.spyOn(userRepository, 'findById').mockResolvedValue(mockUser);

      const command = new RefreshTokenCommand('refresh-token', '192.168.1.1', 'Mozilla/5.0');
      const result = await handler.execute(command);

      expect(result.success).toBe(false);
      expect(result.error).toBe(RefreshTokenError.TOKEN_REVOKED);
    });

    it('should successfully refresh token', async () => {
      const mockPayload: JwtPayload = { sub: 'user-123', email: '', jti: 'jti-123' };
      const mockAccessToken = 'new-access-token';
      const mockNewRefreshToken = {
        token: 'new-refresh-token',
        expiresAt: new Date(Date.now() + 604800000),
        jti: 'new-jti-123',
      };

      jest.spyOn(tokenService, 'verifyRefreshToken').mockResolvedValue(mockPayload);
      jest.spyOn(tokenService, 'hashToken')
        .mockResolvedValueOnce('hashed-token') // For input token
        .mockResolvedValueOnce('hashed-new-token'); // For new token
      jest.spyOn(refreshTokenRepository, 'findByToken').mockResolvedValue(mockStoredToken);
      jest.spyOn(userRepository, 'findById').mockResolvedValue(mockUser);
      jest.spyOn(refreshTokenRepository, 'revokeAtomically').mockResolvedValue(true);
      jest.spyOn(tokenService, 'generateAccessToken').mockResolvedValue(mockAccessToken);
      jest.spyOn(tokenService, 'generateRefreshToken').mockResolvedValue(mockNewRefreshToken);
      jest.spyOn(refreshTokenRepository, 'create').mockResolvedValue();
      jest.spyOn(refreshTokenRepository, 'recordUsage').mockResolvedValue();

      const command = new RefreshTokenCommand('refresh-token', '192.168.1.1', 'Mozilla/5.0');
      const result = await handler.execute(command);

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe(mockAccessToken);
      expect(result.refreshToken).toBe('new-refresh-token');
      expect(refreshTokenRepository.revokeAtomically).toHaveBeenCalledWith('token-id-123');
      expect(refreshTokenRepository.recordUsage).toHaveBeenCalledWith('token-id-123');
    });

    it('should return internal error on exception', async () => {
      jest.spyOn(tokenService, 'verifyRefreshToken').mockRejectedValue(new Error('Unexpected error'));

      const command = new RefreshTokenCommand('refresh-token', '192.168.1.1', 'Mozilla/5.0');
      const result = await handler.execute(command);

      expect(result.success).toBe(false);
      expect(result.error).toBe(RefreshTokenError.INTERNAL_ERROR);
    });
  });
});
