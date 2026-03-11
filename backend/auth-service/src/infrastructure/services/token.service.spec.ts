import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TokenService, JwtPayload } from './token.service';
import { sign, verify } from 'jsonwebtoken';

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn(),
}));

describe('TokenService', () => {
  let service: TokenService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<TokenService>(TokenService);
    configService = module.get<ConfigService>(ConfigService);

    // Setup default config values
    mockConfigService.get.mockImplementation((key: string, defaultValue: any) => {
      const config: Record<string, any> = {
        JWT_ACCESS_SECRET: 'test-access-secret',
        JWT_REFRESH_SECRET: 'test-refresh-secret',
        JWT_ACCESS_EXPIRES_IN: 3600,
        JWT_REFRESH_EXPIRES_IN: 604800,
      };
      return config[key] ?? defaultValue;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateSecureToken', () => {
    it('should generate a cryptographically secure token', () => {
      const token = service.generateSecureToken();

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('should generate different tokens on each call', () => {
      const token1 = service.generateSecureToken();
      const token2 = service.generateSecureToken();

      expect(token1).not.toBe(token2);
    });

    it('should generate base64url encoded token', () => {
      const token = service.generateSecureToken();

      // Base64url should only contain alphanumeric, -, and _
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe('hashToken', () => {
    it('should hash token using SHA-256', async () => {
      const token = 'test-token-123';
      const hash = await service.hashToken(token);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64); // SHA-256 produces 64 hex characters
    });

    it('should produce consistent hashes for same input', async () => {
      const token = 'test-token-123';
      const hash1 = await service.hashToken(token);
      const hash2 = await service.hashToken(token);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', async () => {
      const hash1 = await service.hashToken('token1');
      const hash2 = await service.hashToken('token2');

      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty string', async () => {
      const hash = await service.hashToken('');

      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);
    });
  });

  describe('generateAccessToken', () => {
    const userId = 'user-123';
    const email = 'test@example.com';
    const mockAccessToken = 'mock-access-token';

    beforeEach(() => {
      (sign as jest.Mock).mockReturnValue(mockAccessToken);
    });

    it('should generate JWT access token', async () => {
      const token = await service.generateAccessToken(userId, email);

      expect(token).toBe(mockAccessToken);
      expect(sign).toHaveBeenCalled();
    });

    it('should include correct payload claims', async () => {
      await service.generateAccessToken(userId, email);

      expect(sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: userId,
          email: email,
          jti: expect.any(String),
        }),
        'test-access-secret',
        expect.any(Object),
      );
    });

    it('should include unique jti in each token', async () => {
      await service.generateAccessToken(userId, email);
      const call1Jti = (sign as jest.Mock).mock.calls[0][0].jti;
      
      await service.generateAccessToken(userId, email);
      const call2Jti = (sign as jest.Mock).mock.calls[1][0].jti;

      expect(call1Jti).not.toBe(call2Jti);
    });

    it('should use correct expiration time', async () => {
      await service.generateAccessToken(userId, email);

      expect(sign).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(String),
        expect.objectContaining({
          expiresIn: 3600,
        }),
      );
    });
  });

  describe('generateRefreshToken', () => {
    const userId = 'user-123';
    const mockRefreshToken = 'mock-refresh-token';

    beforeEach(() => {
      (sign as jest.Mock).mockReturnValue(mockRefreshToken);
    });

    it('should generate JWT refresh token', async () => {
      const result = await service.generateRefreshToken(userId);

      expect(result.token).toBe(mockRefreshToken);
      expect(sign).toHaveBeenCalled();
    });

    it('should include correct payload claims', async () => {
      await service.generateRefreshToken(userId);

      expect(sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: userId,
          email: '', // Empty email for refresh token
          jti: expect.any(String),
        }),
        'test-refresh-secret',
        expect.any(Object),
      );
    });

    it('should return expiresAt date', async () => {
      const result = await service.generateRefreshToken(userId);

      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should return jti', async () => {
      const result = await service.generateRefreshToken(userId);

      expect(result.jti).toBeDefined();
      expect(typeof result.jti).toBe('string');
    });

    it('should calculate correct expiration time', async () => {
      const beforeCall = Date.now();
      const result = await service.generateRefreshToken(userId);
      const afterCall = Date.now();

      const expectedMin = beforeCall + 604800 * 1000; // 7 days in ms
      const expectedMax = afterCall + 604800 * 1000;

      expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMin - 1000);
      expect(result.expiresAt.getTime()).toBeLessThanOrEqual(expectedMax + 1000);
    });

    it('should include unique jti in each token', async () => {
      const result1 = await service.generateRefreshToken(userId);
      const result2 = await service.generateRefreshToken(userId);

      expect(result1.jti).not.toBe(result2.jti);
    });

    it('should not include email in refresh token payload', async () => {
      await service.generateRefreshToken(userId);

      const payload = (sign as jest.Mock).mock.calls[0][0];
      expect(payload.email).toBe('');
    });
  });

  describe('verifyAccessToken', () => {
    const mockPayload: JwtPayload = {
      sub: 'user-123',
      email: 'test@example.com',
      jti: 'jti-123',
    };

    it('should verify valid access token', async () => {
      (verify as jest.Mock).mockReturnValue(mockPayload);

      const result = await service.verifyAccessToken('valid-token');

      expect(result).toEqual(mockPayload);
      expect(verify).toHaveBeenCalledWith('valid-token', 'test-access-secret');
    });

    it('should return null for invalid token', async () => {
      (verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = await service.verifyAccessToken('invalid-token');

      expect(result).toBeNull();
    });

    it('should return null for expired token', async () => {
      (verify as jest.Mock).mockImplementation(() => {
        throw new Error('Token expired');
      });

      const result = await service.verifyAccessToken('expired-token');

      expect(result).toBeNull();
    });

    it('should handle token with missing claims', async () => {
      const partialPayload = { sub: 'user-123' };
      (verify as jest.Mock).mockReturnValue(partialPayload);

      const result = await service.verifyAccessToken('partial-token');

      expect(result).toEqual(partialPayload);
    });
  });

  describe('verifyRefreshToken', () => {
    const mockPayload: JwtPayload = {
      sub: 'user-123',
      email: '',
      jti: 'jti-123',
    };

    it('should verify valid refresh token', async () => {
      (verify as jest.Mock).mockReturnValue(mockPayload);

      const result = await service.verifyRefreshToken('valid-token');

      expect(result).toEqual(mockPayload);
      expect(verify).toHaveBeenCalledWith('valid-token', 'test-refresh-secret');
    });

    it('should return null for invalid refresh token', async () => {
      (verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = await service.verifyRefreshToken('invalid-token');

      expect(result).toBeNull();
    });

    it('should return null for expired refresh token', async () => {
      (verify as jest.Mock).mockImplementation(() => {
        throw new Error('Token expired');
      });

      const result = await service.verifyRefreshToken('expired-token');

      expect(result).toBeNull();
    });

    it('should use refresh secret for verification', async () => {
      (verify as jest.Mock).mockReturnValue(mockPayload);

      await service.verifyRefreshToken('token');

      expect(verify).toHaveBeenCalledWith('token', 'test-refresh-secret');
    });
  });

  describe('getAccessTokenExpiresIn', () => {
    it('should return configured expiration time', () => {
      const expiresIn = service.getAccessTokenExpiresIn();

      expect(expiresIn).toBe(3600);
    });
  });
});
