import { RefreshToken } from './refresh-token.entity';

describe('RefreshToken Entity', () => {
  const validUserId = 'user-123';
  const validTokenHash = 'hashed_token_abc123';
  const validJti = 'jti-unique-identifier';
  const validExpiresAt = new Date(Date.now() + 3600000); // 1 hour from now

  describe('create', () => {
    it('should create a new refresh token with correct default values', () => {
      const refreshToken = RefreshToken.create(
        validUserId,
        validTokenHash,
        validJti,
        validExpiresAt,
      );
      const props = refreshToken.toProps();

      expect(refreshToken).toBeInstanceOf(RefreshToken);
      expect(props.userId).toBe(validUserId);
      expect(props.tokenHash).toBe(validTokenHash);
      expect(props.jti).toBe(validJti);
      expect(props.expiresAt).toEqual(validExpiresAt);
      expect(props.revokedAt).toBeNull();
      expect(props.ipAddress).toBeUndefined();
      expect(props.userAgent).toBeUndefined();
      expect(props.id).toBeDefined();
      expect(props.createdAt).toBeInstanceOf(Date);
    });

    it('should create refresh token with optional ipAddress and userAgent', () => {
      const ipAddress = '192.168.1.1';
      const userAgent = 'Mozilla/5.0';

      const refreshToken = RefreshToken.create(
        validUserId,
        validTokenHash,
        validJti,
        validExpiresAt,
        ipAddress,
        userAgent,
      );
      const props = refreshToken.toProps();

      expect(props.ipAddress).toBe(ipAddress);
      expect(props.userAgent).toBe(userAgent);
    });
  });

  describe('toProps', () => {
    it('should return a copy of refresh token properties', () => {
      const refreshToken = RefreshToken.create(
        validUserId,
        validTokenHash,
        validJti,
        validExpiresAt,
      );
      const props = refreshToken.toProps();

      expect(props).toEqual(refreshToken.toProps());
      expect(props).not.toBe(refreshToken.toProps()); // Should be a copy
    });
  });

  describe('isExpired', () => {
    it('should return false when expiresAt is in the future', () => {
      const futureDate = new Date(Date.now() + 3600000);
      const refreshToken = RefreshToken.create(
        validUserId,
        validTokenHash,
        validJti,
        futureDate,
      );
      expect(refreshToken.isExpired()).toBe(false);
    });

    it('should return true when expiresAt is in the past', () => {
      const pastDate = new Date(Date.now() - 3600000);
      const refreshToken = RefreshToken.create(
        validUserId,
        validTokenHash,
        validJti,
        pastDate,
      );
      expect(refreshToken.isExpired()).toBe(true);
    });
  });

  describe('isRevoked', () => {
    it('should return false when token is not revoked', () => {
      const refreshToken = RefreshToken.create(
        validUserId,
        validTokenHash,
        validJti,
        validExpiresAt,
      );
      expect(refreshToken.isRevoked()).toBe(false);
    });

    it('should return true when token is revoked', () => {
      const refreshToken = RefreshToken.create(
        validUserId,
        validTokenHash,
        validJti,
        validExpiresAt,
      );
      refreshToken.revoke();
      expect(refreshToken.isRevoked()).toBe(true);
    });
  });

  describe('isValid', () => {
    it('should return true when token is not expired and not revoked', () => {
      const futureDate = new Date(Date.now() + 3600000);
      const refreshToken = RefreshToken.create(
        validUserId,
        validTokenHash,
        validJti,
        futureDate,
      );
      expect(refreshToken.isValid()).toBe(true);
    });

    it('should return false when token is expired', () => {
      const pastDate = new Date(Date.now() - 3600000);
      const refreshToken = RefreshToken.create(
        validUserId,
        validTokenHash,
        validJti,
        pastDate,
      );
      expect(refreshToken.isValid()).toBe(false);
    });

    it('should return false when token is revoked', () => {
      const futureDate = new Date(Date.now() + 3600000);
      const refreshToken = RefreshToken.create(
        validUserId,
        validTokenHash,
        validJti,
        futureDate,
      );
      refreshToken.revoke();
      expect(refreshToken.isValid()).toBe(false);
    });
  });

  describe('revoke', () => {
    it('should set revokedAt to current date', () => {
      const refreshToken = RefreshToken.create(
        validUserId,
        validTokenHash,
        validJti,
        validExpiresAt,
      );
      const beforeDate = Date.now();

      refreshToken.revoke();

      const afterDate = Date.now();
      const revokedAt = refreshToken.getRevokedAt();
      expect(revokedAt).toBeInstanceOf(Date);
      expect(revokedAt!.getTime()).toBeGreaterThanOrEqual(beforeDate);
      expect(revokedAt!.getTime()).toBeLessThanOrEqual(afterDate);
    });
  });

  describe('matchesToken', () => {
    it('should return true when token hash matches', () => {
      const refreshToken = RefreshToken.create(
        validUserId,
        validTokenHash,
        validJti,
        validExpiresAt,
      );
      expect(refreshToken.matchesToken(validTokenHash)).toBe(true);
    });

    it('should return false when token hash does not match', () => {
      const refreshToken = RefreshToken.create(
        validUserId,
        validTokenHash,
        validJti,
        validExpiresAt,
      );
      expect(refreshToken.matchesToken('different_hash')).toBe(false);
    });
  });

  describe('getters', () => {
    it('should return all refresh token properties via getters', () => {
      const ipAddress = '192.168.1.1';
      const userAgent = 'Mozilla/5.0';

      const refreshToken = RefreshToken.create(
        validUserId,
        validTokenHash,
        validJti,
        validExpiresAt,
        ipAddress,
        userAgent,
      );
      const props = refreshToken.toProps();

      expect(refreshToken.getId()).toBe(props.id);
      expect(refreshToken.getUserId()).toBe(props.userId);
      expect(refreshToken.getTokenHash()).toBe(props.tokenHash);
      expect(refreshToken.getJti()).toBe(props.jti);
      expect(refreshToken.getExpiresAt()).toEqual(props.expiresAt);
      expect(refreshToken.getRevokedAt()).toBe(props.revokedAt);
      expect(refreshToken.getCreatedAt()).toEqual(props.createdAt);
      expect(refreshToken.getIpAddress()).toBe(props.ipAddress);
      expect(refreshToken.getUserAgent()).toBe(props.userAgent);
    });
  });
});
