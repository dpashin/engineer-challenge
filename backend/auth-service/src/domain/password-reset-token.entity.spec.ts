import { PasswordResetToken } from './password-reset-token.entity';

describe('PasswordResetToken', () => {
  const createToken = (overrides?: Partial<ReturnType<typeof PasswordResetToken.prototype.toProps>>) => {
    const props: ReturnType<typeof PasswordResetToken.prototype.toProps> = {
      id: 'test-id',
      userId: 'user-id',
      tokenHash: 'test-hash',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes in future
      usedAt: null,
      revokedAt: null,
      createdAt: new Date(),
      ...overrides,
    };
    return new PasswordResetToken(props);
  };

  describe('create', () => {
    it('should create a new token with correct properties', () => {
      const userId = 'user-123';
      const tokenHash = 'hash-abc';
      const expiresAt = new Date(Date.now() + 600000);

      const token = PasswordResetToken.create(userId, tokenHash, expiresAt);
      const props = token.toProps();

      expect(props.id).toBeDefined();
      expect(props.userId).toBe(userId);
      expect(props.tokenHash).toBe(tokenHash);
      expect(props.expiresAt).toEqual(expiresAt);
      expect(props.usedAt).toBeNull();
      expect(props.revokedAt).toBeNull();
      expect(props.createdAt).toBeDefined();
    });
  });

  describe('isExpired', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return false for future expiration', () => {
      jest.setSystemTime(new Date('2024-01-01T12:00:00Z'));
      const token = createToken({
        expiresAt: new Date('2024-01-01T12:05:00Z'),
      });
      expect(token.isExpired()).toBe(false);
    });

    it('should return true for past expiration', () => {
      jest.setSystemTime(new Date('2024-01-01T12:00:00Z'));
      const token = createToken({
        expiresAt: new Date('2024-01-01T11:55:00Z'),
      });
      expect(token.isExpired()).toBe(true);
    });
  });

  describe('isUsed', () => {
    it('should return false when usedAt is null', () => {
      const token = createToken({ usedAt: null });
      expect(token.isUsed()).toBe(false);
    });

    it('should return true when usedAt is set', () => {
      const token = createToken({ usedAt: new Date() });
      expect(token.isUsed()).toBe(true);
    });
  });

  describe('isRevoked', () => {
    it('should return false when revokedAt is null', () => {
      const token = createToken({ revokedAt: null });
      expect(token.isRevoked()).toBe(false);
    });

    it('should return true when revokedAt is set', () => {
      const token = createToken({ revokedAt: new Date() });
      expect(token.isRevoked()).toBe(true);
    });
  });

  describe('isValid', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-01T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return true for valid token', () => {
      const token = createToken({
        expiresAt: new Date('2024-01-01T12:05:00Z'),
        usedAt: null,
        revokedAt: null,
      });
      expect(token.isValid()).toBe(true);
    });

    it('should return false when expired', () => {
      const token = createToken({
        expiresAt: new Date('2024-01-01T11:55:00Z'),
        usedAt: null,
        revokedAt: null,
      });
      expect(token.isValid()).toBe(false);
    });

    it('should return false when used', () => {
      const token = createToken({
        expiresAt: new Date('2024-01-01T12:05:00Z'),
        usedAt: new Date('2024-01-01T12:01:00Z'),
        revokedAt: null,
      });
      expect(token.isValid()).toBe(false);
    });

    it('should return false when revoked', () => {
      const token = createToken({
        expiresAt: new Date('2024-01-01T12:05:00Z'),
        usedAt: null,
        revokedAt: new Date('2024-01-01T12:01:00Z'),
      });
      expect(token.isValid()).toBe(false);
    });
  });

  describe('markAsUsed', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-01T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should set usedAt to current time', () => {
      const token = createToken({ usedAt: null });
      token.markAsUsed();
      expect(token.toProps().usedAt).toEqual(new Date('2024-01-01T12:00:00Z'));
    });
  });

  describe('revoke', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-01T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should set revokedAt to current time', () => {
      const token = createToken({ revokedAt: null });
      token.revoke();
      expect(token.toProps().revokedAt).toEqual(new Date('2024-01-01T12:00:00Z'));
    });
  });
});
