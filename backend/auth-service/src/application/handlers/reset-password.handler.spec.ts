import { ResetPasswordHandler } from './reset-password.handler';
import { ResetPasswordCommand } from '../commands/reset-password.command';
import { ResetPasswordError } from '../commands/reset-password.result';

describe('ResetPasswordHandler', () => {
  let handler: ResetPasswordHandler;
  let mockResetTokenRepository: any;
  let mockUserRepository: any;
  let mockPasswordHasher: any;

  beforeEach(() => {
    mockResetTokenRepository = {
      findByToken: jest.fn(),
      markAsUsed: jest.fn(),
      invalidateAllUserTokens: jest.fn(),
    };

    mockUserRepository = {
      findById: jest.fn(),
      changePassword: jest.fn(),
      recordFailedReset: jest.fn(),
      findWithFailedResetAttemptsById: jest.fn(),
      blockResetRequests: jest.fn(),
      unblockResetRequests: jest.fn(),
    };

    mockPasswordHasher = {
      hash: jest.fn(),
    };

    handler = new ResetPasswordHandler(
      mockResetTokenRepository,
      mockUserRepository,
      mockPasswordHasher,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-01T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should successfully reset password with valid token', async () => {
      const command = new ResetPasswordCommand('valid-token', 'NewPass123!');

      mockResetTokenRepository.findByToken.mockResolvedValue({
        id: 'token-id',
        userId: 'user-id',
        tokenHash: 'token-hash',
        expiresAt: new Date('2024-01-01T12:05:00Z'),
        usedAt: null,
        revokedAt: null,
      });

      mockUserRepository.findById.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
      });

      mockPasswordHasher.hash.mockResolvedValue('new-hashed-password');

      const result = await handler.execute(command);

      expect(result.success).toBe(true);
      expect(mockResetTokenRepository.findByToken).toHaveBeenCalled();
      expect(mockUserRepository.findById).toHaveBeenCalledWith('user-id');
      expect(mockPasswordHasher.hash).toHaveBeenCalledWith('NewPass123!');
      expect(mockUserRepository.changePassword).toHaveBeenCalledWith(
        'user-id',
        'new-hashed-password',
      );
      expect(mockResetTokenRepository.markAsUsed).toHaveBeenCalledWith('token-id');
      expect(mockResetTokenRepository.invalidateAllUserTokens).toHaveBeenCalledWith(
        'user-id',
      );
    });

    it('should fail with invalid password', async () => {
      const command = new ResetPasswordCommand('any-token', 'weak');

      const result = await handler.execute(command);

      expect(result.success).toBe(false);
      expect(result.error).toBe(ResetPasswordError.INVALID_PASSWORD);
      expect(mockResetTokenRepository.findByToken).not.toHaveBeenCalled();
    });

    it('should fail with invalid token', async () => {
      const command = new ResetPasswordCommand('invalid-token', 'NewPass123!');

      mockResetTokenRepository.findByToken.mockResolvedValue(null);

      const result = await handler.execute(command);

      expect(result.success).toBe(false);
      expect(result.error).toBe(ResetPasswordError.INVALID_TOKEN);
    });

    it('should fail with expired token', async () => {
      const command = new ResetPasswordCommand('valid-token', 'NewPass123!');

      mockResetTokenRepository.findByToken.mockResolvedValue({
        id: 'token-id',
        userId: 'user-id',
        tokenHash: 'token-hash',
        expiresAt: new Date('2024-01-01T11:55:00Z'), // Expired
        usedAt: null,
        revokedAt: null,
      });

      const result = await handler.execute(command);

      expect(result.success).toBe(false);
      expect(result.error).toBe(ResetPasswordError.TOKEN_EXPIRED);
    });

    it('should fail with already used token', async () => {
      const command = new ResetPasswordCommand('valid-token', 'NewPass123!');

      mockResetTokenRepository.findByToken.mockResolvedValue({
        id: 'token-id',
        userId: 'user-id',
        tokenHash: 'token-hash',
        expiresAt: new Date('2024-01-01T12:05:00Z'),
        usedAt: new Date('2024-01-01T11:55:00Z'),
        revokedAt: null,
      });

      const result = await handler.execute(command);

      expect(result.success).toBe(false);
      expect(result.error).toBe(ResetPasswordError.TOKEN_ALREADY_USED);
    });

    it('should fail with revoked token', async () => {
      const command = new ResetPasswordCommand('valid-token', 'NewPass123!');

      mockResetTokenRepository.findByToken.mockResolvedValue({
        id: 'token-id',
        userId: 'user-id',
        tokenHash: 'token-hash',
        expiresAt: new Date('2024-01-01T12:05:00Z'),
        usedAt: null,
        revokedAt: new Date('2024-01-01T11:55:00Z'),
      });

      const result = await handler.execute(command);

      expect(result.success).toBe(false);
      expect(result.error).toBe(ResetPasswordError.INVALID_TOKEN);
    });

    it('should fail when user not found', async () => {
      const command = new ResetPasswordCommand('valid-token', 'NewPass123!');

      mockResetTokenRepository.findByToken.mockResolvedValue({
        id: 'token-id',
        userId: 'non-existent-user',
        tokenHash: 'token-hash',
        expiresAt: new Date('2024-01-01T12:05:00Z'),
        usedAt: null,
        revokedAt: null,
      });

      mockUserRepository.findById.mockResolvedValue(null);

      const result = await handler.execute(command);

      expect(result.success).toBe(false);
      expect(result.error).toBe(ResetPasswordError.INTERNAL_ERROR);
    });

    it('should handle internal errors gracefully', async () => {
      const command = new ResetPasswordCommand('valid-token', 'NewPass123!');

      mockResetTokenRepository.findByToken.mockRejectedValue(
        new Error('Database error'),
      );

      const result = await handler.execute(command);

      expect(result.success).toBe(false);
      expect(result.error).toBe(ResetPasswordError.INTERNAL_ERROR);
    });

    it('should record failed attempt and block user after 3 failed attempts (expired token)', async () => {
      const command = new ResetPasswordCommand('valid-token', 'NewPass123!');

      mockResetTokenRepository.findByToken.mockResolvedValue({
        id: 'token-id',
        userId: 'user-id',
        tokenHash: 'token-hash',
        expiresAt: new Date('2024-01-01T11:55:00Z'), // Expired
        usedAt: null,
        revokedAt: null,
      });

      mockUserRepository.findWithFailedResetAttemptsById.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        failedResetAttempts: 3,
      });

      const result = await handler.execute(command);

      expect(result.success).toBe(false);
      expect(result.error).toBe(ResetPasswordError.TOKEN_EXPIRED);
      expect(mockUserRepository.recordFailedReset).toHaveBeenCalledWith('user-id');
      expect(mockUserRepository.blockResetRequests).toHaveBeenCalled();
    });

    it('should record failed attempt without blocking (2 failed attempts)', async () => {
      const command = new ResetPasswordCommand('valid-token', 'NewPass123!');

      mockResetTokenRepository.findByToken.mockResolvedValue({
        id: 'token-id',
        userId: 'user-id',
        tokenHash: 'token-hash',
        expiresAt: new Date('2024-01-01T11:55:00Z'), // Expired
        usedAt: null,
        revokedAt: null,
      });

      mockUserRepository.findWithFailedResetAttemptsById.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        failedResetAttempts: 2,
      });

      const result = await handler.execute(command);

      expect(result.success).toBe(false);
      expect(result.error).toBe(ResetPasswordError.TOKEN_EXPIRED);
      expect(mockUserRepository.recordFailedReset).toHaveBeenCalledWith('user-id');
      expect(mockUserRepository.blockResetRequests).not.toHaveBeenCalled();
    });

    it('should record failed attempt for already used token', async () => {
      const command = new ResetPasswordCommand('valid-token', 'NewPass123!');

      mockResetTokenRepository.findByToken.mockResolvedValue({
        id: 'token-id',
        userId: 'user-id',
        tokenHash: 'token-hash',
        expiresAt: new Date('2024-01-01T12:05:00Z'),
        usedAt: new Date('2024-01-01T11:55:00Z'),
        revokedAt: null,
      });

      mockUserRepository.findWithFailedResetAttemptsById.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        failedResetAttempts: 1,
      });

      const result = await handler.execute(command);

      expect(result.success).toBe(false);
      expect(result.error).toBe(ResetPasswordError.TOKEN_ALREADY_USED);
      expect(mockUserRepository.recordFailedReset).toHaveBeenCalledWith('user-id');
    });

    it('should record failed attempt for revoked token', async () => {
      const command = new ResetPasswordCommand('valid-token', 'NewPass123!');

      mockResetTokenRepository.findByToken.mockResolvedValue({
        id: 'token-id',
        userId: 'user-id',
        tokenHash: 'token-hash',
        expiresAt: new Date('2024-01-01T12:05:00Z'),
        usedAt: null,
        revokedAt: new Date('2024-01-01T11:55:00Z'),
      });

      mockUserRepository.findWithFailedResetAttemptsById.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        failedResetAttempts: 1,
      });

      const result = await handler.execute(command);

      expect(result.success).toBe(false);
      expect(result.error).toBe(ResetPasswordError.INVALID_TOKEN);
      expect(mockUserRepository.recordFailedReset).toHaveBeenCalledWith('user-id');
    });

    it('should unblock user after successful password reset', async () => {
      const command = new ResetPasswordCommand('valid-token', 'NewPass123!');

      mockResetTokenRepository.findByToken.mockResolvedValue({
        id: 'token-id',
        userId: 'user-id',
        tokenHash: 'token-hash',
        expiresAt: new Date('2024-01-01T12:05:00Z'),
        usedAt: null,
        revokedAt: null,
      });

      mockUserRepository.findById.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
      });

      mockPasswordHasher.hash.mockResolvedValue('new-hashed-password');

      const result = await handler.execute(command);

      expect(result.success).toBe(true);
      expect(mockUserRepository.unblockResetRequests).toHaveBeenCalledWith('user-id');
    });
  });
});
