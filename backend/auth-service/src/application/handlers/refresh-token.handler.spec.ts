import { RefreshTokenHandler } from './refresh-token.handler';
import { RefreshTokenCommand } from '../commands/refresh-token.command';
import { RefreshTokenError } from '../commands/refresh-token.result';
import { TokenService } from '../../infrastructure/services/token.service';
import { ConfigService } from '@nestjs/config';

describe('RefreshTokenHandler - Replay Attack Protection', () => {
  let handler: RefreshTokenHandler;
  let mockRefreshTokenRepository: any;
  let mockUserRepository: any;
  let mockTokenService: any;
  let mockPasswordHasher: any;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    isActive: true,
  };

  const mockStoredToken = {
    id: 'token-456',
    userId: 'user-123',
    tokenHash: 'hashed-refresh-token',
    jti: 'unique-jti-123',
    expiresAt: new Date('2030-01-01T00:00:00Z'),
    revokedAt: null,
    lastUsedAt: null,
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
  };

  beforeEach(() => {
    mockRefreshTokenRepository = {
      findByToken: jest.fn(),
      revokeAtomically: jest.fn(),
      revoke: jest.fn(),
      create: jest.fn(),
      recordUsage: jest.fn(),
    };

    mockUserRepository = {
      findById: jest.fn(),
    };

    mockTokenService = {
      verifyRefreshToken: jest.fn(),
      hashToken: jest.fn(),
      generateAccessToken: jest.fn(),
      generateRefreshToken: jest.fn(),
      getAccessTokenExpiresIn: jest.fn(),
    };

    mockPasswordHasher = {};

    handler = new RefreshTokenHandler(
      mockRefreshTokenRepository,
      mockUserRepository,
      mockTokenService,
      mockPasswordHasher,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Replay Attack Prevention', () => {
    it('should successfully refresh token on first request', async () => {
      const command = new RefreshTokenCommand('valid-refresh-token', '192.168.1.1', 'Mozilla/5.0');

      mockTokenService.verifyRefreshToken.mockResolvedValue({
        sub: 'user-123',
        email: '',
        jti: 'unique-jti-123',
      });

      mockTokenService.hashToken.mockResolvedValue('hashed-refresh-token');
      mockRefreshTokenRepository.findByToken.mockResolvedValue(mockStoredToken);
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockRefreshTokenRepository.revokeAtomically.mockResolvedValue(true);
      mockTokenService.generateAccessToken.mockResolvedValue('new-access-token');
      mockTokenService.generateRefreshToken.mockResolvedValue({
        token: 'new-refresh-token',
        expiresAt: new Date('2030-01-01T00:00:00Z'),
        jti: 'new-jti-456',
      });
      mockTokenService.hashToken.mockResolvedValueOnce('new-hashed-token');
      mockTokenService.getAccessTokenExpiresIn.mockReturnValue(3600);

      const result = await handler.execute(command);

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('new-access-token');
      expect(mockRefreshTokenRepository.revokeAtomically).toHaveBeenCalledWith('token-456');
      expect(mockRefreshTokenRepository.create).toHaveBeenCalled();
    });

    it('should reject replay attack on second concurrent request', async () => {
      const command = new RefreshTokenCommand('valid-refresh-token', '192.168.1.1', 'Mozilla/5.0');

      mockTokenService.verifyRefreshToken.mockResolvedValue({
        sub: 'user-123',
        email: '',
        jti: 'unique-jti-123',
      });

      mockTokenService.hashToken.mockResolvedValue('hashed-refresh-token');
      mockRefreshTokenRepository.findByToken.mockResolvedValue(mockStoredToken);
      mockUserRepository.findById.mockResolvedValue(mockUser);
      
      // First request succeeds in revoking
      mockRefreshTokenRepository.revokeAtomically.mockResolvedValueOnce(true);
      // Second concurrent request fails - token already revoked
      mockRefreshTokenRepository.revokeAtomically.mockResolvedValueOnce(false);
      
      mockTokenService.generateAccessToken.mockResolvedValue('new-access-token');
      mockTokenService.generateRefreshToken.mockResolvedValue({
        token: 'new-refresh-token',
        expiresAt: new Date('2030-01-01T00:00:00Z'),
        jti: 'new-jti-456',
      });
      mockTokenService.getAccessTokenExpiresIn.mockReturnValue(3600);

      // First request - should succeed
      const result1 = await handler.execute(command);
      expect(result1.success).toBe(true);

      // Second request (replay attack) - should fail
      const result2 = await handler.execute(command);
      expect(result2.success).toBe(false);
      expect(result2.error).toBe(RefreshTokenError.TOKEN_REVOKED);
    });

    it('should reject token with JTI mismatch', async () => {
      const command = new RefreshTokenCommand('valid-refresh-token', '192.168.1.1', 'Mozilla/5.0');

      mockTokenService.verifyRefreshToken.mockResolvedValue({
        sub: 'user-123',
        email: '',
        jti: 'different-jti-999', // Mismatched JTI
      });

      mockTokenService.hashToken.mockResolvedValue('hashed-refresh-token');
      mockRefreshTokenRepository.findByToken.mockResolvedValue(mockStoredToken);

      const result = await handler.execute(command);

      expect(result.success).toBe(false);
      expect(result.error).toBe(RefreshTokenError.INVALID_TOKEN);
    });

    it('should reject token with IP address mismatch', async () => {
      const command = new RefreshTokenCommand('valid-refresh-token', '10.0.0.1', 'Mozilla/5.0'); // Different IP

      mockTokenService.verifyRefreshToken.mockResolvedValue({
        sub: 'user-123',
        email: '',
        jti: 'unique-jti-123',
      });

      mockTokenService.hashToken.mockResolvedValue('hashed-refresh-token');
      mockRefreshTokenRepository.findByToken.mockResolvedValue(mockStoredToken);

      const result = await handler.execute(command);

      expect(result.success).toBe(false);
      expect(result.error).toBe(RefreshTokenError.INVALID_TOKEN);
    });

    it('should reject token with User Agent mismatch', async () => {
      const command = new RefreshTokenCommand('valid-refresh-token', '192.168.1.1', 'Different Browser');

      mockTokenService.verifyRefreshToken.mockResolvedValue({
        sub: 'user-123',
        email: '',
        jti: 'unique-jti-123',
      });

      mockTokenService.hashToken.mockResolvedValue('hashed-refresh-token');
      mockRefreshTokenRepository.findByToken.mockResolvedValue(mockStoredToken);

      const result = await handler.execute(command);

      expect(result.success).toBe(false);
      expect(result.error).toBe(RefreshTokenError.INVALID_TOKEN);
    });

    it('should allow token refresh when IP/UserAgent not provided (backward compatibility)', async () => {
      const command = new RefreshTokenCommand('valid-refresh-token', undefined, undefined);

      mockTokenService.verifyRefreshToken.mockResolvedValue({
        sub: 'user-123',
        email: '',
        jti: 'unique-jti-123',
      });

      mockTokenService.hashToken.mockResolvedValue('hashed-refresh-token');
      mockRefreshTokenRepository.findByToken.mockResolvedValue(mockStoredToken);
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockRefreshTokenRepository.revokeAtomically.mockResolvedValue(true);
      mockTokenService.generateAccessToken.mockResolvedValue('new-access-token');
      mockTokenService.generateRefreshToken.mockResolvedValue({
        token: 'new-refresh-token',
        expiresAt: new Date('2030-01-01T00:00:00Z'),
        jti: 'new-jti-456',
      });
      mockTokenService.getAccessTokenExpiresIn.mockReturnValue(3600);

      const result = await handler.execute(command);

      expect(result.success).toBe(true);
    });
  });
});
