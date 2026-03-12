import { UserRepository } from './user.repository';
import { DatabaseService } from '../database/database.service';

describe('UserRepository', () => {
  let repository: UserRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
    };

    repository = new UserRepository(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('recordFailedReset', () => {
    it('should increment failed_reset_attempts and set last_failed_reset_at', async () => {
      mockDb.query.mockResolvedValue([]);

      await repository.recordFailedReset('user-123');

      const callArgs = mockDb.query.mock.calls[0];
      const sql = callArgs[0];

      expect(sql).toContain('failed_reset_attempts = failed_reset_attempts + 1');
      expect(sql).toContain('last_failed_reset_at = NOW()');
      expect(callArgs[1]).toEqual(['user-123']);
    });
  });

  describe('blockResetRequests', () => {
    it('should set reset_request_blocked_until to the specified date', async () => {
      mockDb.query.mockResolvedValue([]);
      const blockedUntil = new Date('2024-01-01T13:00:00Z');

      await repository.blockResetRequests('user-123', blockedUntil);

      const callArgs = mockDb.query.mock.calls[0];
      const sql = callArgs[0];

      expect(sql).toContain('reset_request_blocked_until = $1');
      expect(callArgs[1]).toEqual([blockedUntil, 'user-123']);
    });
  });

  describe('unblockResetRequests', () => {
    it('should clear reset_request_blocked_until, failed_reset_attempts, and last_failed_reset_at', async () => {
      mockDb.query.mockResolvedValue([]);

      await repository.unblockResetRequests('user-123');

      const callArgs = mockDb.query.mock.calls[0];
      const sql = callArgs[0];

      expect(sql).toContain('reset_request_blocked_until = NULL');
      expect(sql).toContain('failed_reset_attempts = 0');
      expect(sql).toContain('last_failed_reset_at = NULL');
      expect(callArgs[1]).toEqual(['user-123']);
    });
  });

  describe('findWithFailedResetAttemptsById', () => {
    it('should return user with failedResetAttempts', async () => {
      const mockRow = {
        id: 'user-123',
        email: 'test@example.com',
        is_active: true,
        created_at: new Date('2024-01-01T12:00:00Z'),
        failed_reset_attempts: 2,
      };

      mockDb.query.mockResolvedValue([mockRow]);

      const result = await repository.findWithFailedResetAttemptsById('user-123');

      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        isActive: true,
        createdAt: new Date('2024-01-01T12:00:00Z'),
        failedResetAttempts: 2,
      });
    });

    it('should return null when user not found', async () => {
      mockDb.query.mockResolvedValue([]);

      const result = await repository.findWithFailedResetAttemptsById('non-existent');

      expect(result).toBeNull();
    });
  });
});
