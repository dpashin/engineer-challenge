import { CleanupCronService } from './cleanup-cron.service';
import { CommandBus } from '@nestjs/cqrs';
import { DatabaseService } from '../../database/database.service';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { CleanupExpiredEntitiesCommand } from '../../../application/commands/cleanup-expired-entities.command';

describe('CleanupCronService', () => {
  let service: CleanupCronService;
  let mockCommandBus: CommandBus;
  let mockDatabaseService: DatabaseService;
  let mockConfigService: ConfigService;
  let mockLogger: Logger;

  beforeEach(() => {
    mockCommandBus = {
      execute: jest.fn(),
    } as unknown as CommandBus;

    mockDatabaseService = {
      query: jest.fn(),
    } as unknown as DatabaseService;

    mockConfigService = {
      get: jest.fn(),
    } as unknown as ConfigService;

    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as unknown as Logger;

    jest.spyOn(Logger.prototype, 'log').mockImplementation(mockLogger.log);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(mockLogger.error);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(mockLogger.warn);
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(mockLogger.debug);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should log initialization message', async () => {
      jest.spyOn(mockConfigService, 'get').mockReturnValue(2025030801);

      service = new CleanupCronService(mockCommandBus, mockDatabaseService, mockConfigService);
      await service.onModuleInit();

      expect(mockLogger.log).toHaveBeenCalledWith('CleanupCronService initialized');
    });
  });

  describe('constructor', () => {
    it('should use default lock ID if not provided', () => {
      jest.spyOn(mockConfigService, 'get').mockReturnValue(undefined);

      service = new CleanupCronService(mockCommandBus, mockDatabaseService, mockConfigService);

      expect(mockConfigService.get).toHaveBeenCalledWith('CLEANUP_CRON_LOCK_ID', 2025030801);
    });

    it('should use default lock timeout if not provided', () => {
      jest.spyOn(mockConfigService, 'get').mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'CLEANUP_CRON_LOCK_ID') return 2025030801;
        if (key === 'CLEANUP_CRON_LOCK_TIMEOUT_MS') return defaultValue;
        return defaultValue;
      });

      service = new CleanupCronService(mockCommandBus, mockDatabaseService, mockConfigService);

      expect(mockConfigService.get).toHaveBeenCalledWith('CLEANUP_CRON_LOCK_TIMEOUT_MS', 5000);
    });

    it('should use custom lock ID and timeout from config', () => {
      jest.spyOn(mockConfigService, 'get').mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'CLEANUP_CRON_LOCK_ID') return 99999;
        if (key === 'CLEANUP_CRON_LOCK_TIMEOUT_MS') return 10000;
        return defaultValue;
      });

      service = new CleanupCronService(mockCommandBus, mockDatabaseService, mockConfigService);

      expect(mockConfigService.get).toHaveBeenCalledWith('CLEANUP_CRON_LOCK_ID', 2025030801);
      expect(mockConfigService.get).toHaveBeenCalledWith('CLEANUP_CRON_LOCK_TIMEOUT_MS', 5000);
    });
  });

  describe('handleCleanup', () => {
    beforeEach(() => {
      jest.spyOn(mockConfigService, 'get').mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'CLEANUP_CRON_LOCK_ID') return 2025030801;
        if (key === 'CLEANUP_CRON_LOCK_TIMEOUT_MS') return 5000;
        return defaultValue;
      });

      service = new CleanupCronService(mockCommandBus, mockDatabaseService, mockConfigService);
    });

    it('should acquire lock and execute cleanup successfully', async () => {
      // Mock lock acquisition
      jest.spyOn(mockDatabaseService, 'query').mockResolvedValueOnce([
        { pg_try_advisory_lock: true },
      ]);

      // Mock cleanup execution
      jest.spyOn(mockCommandBus, 'execute').mockResolvedValueOnce({
        passwordResetTokensDeleted: 5,
        refreshTokensDeleted: 10,
        totalDeleted: 15,
      });

      await service.handleCleanup();

      // Verify lock was acquired
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        'SELECT pg_try_advisory_lock($1) as pg_try_advisory_lock',
        [2025030801],
      );

      // Verify cleanup was executed
      expect(mockCommandBus.execute).toHaveBeenCalledWith(
        expect.any(CleanupExpiredEntitiesCommand),
      );

      // Verify lock was released
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        'SELECT pg_advisory_unlock($1)',
        [2025030801],
      );

      // Verify logs
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('Attempting to acquire cleanup lock'));
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('Lock acquired'));
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('Cleanup completed successfully'));
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('Lock released'));
    });

    it('should skip cleanup if lock cannot be acquired', async () => {
      // Mock lock acquisition failure
      jest.spyOn(mockDatabaseService, 'query').mockResolvedValueOnce([
        { pg_try_advisory_lock: false },
      ]);

      await service.handleCleanup();

      // Verify cleanup was NOT executed
      expect(mockCommandBus.execute).not.toHaveBeenCalled();

      // Verify lock was NOT released (since it was never acquired)
      expect(mockDatabaseService.query).not.toHaveBeenCalledWith(
        'SELECT pg_advisory_unlock($1)',
        expect.anything(),
      );

      // Verify logs
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Could not acquire lock'),
      );
    });

    it('should release lock even if cleanup fails', async () => {
      // Mock lock acquisition
      jest.spyOn(mockDatabaseService, 'query').mockResolvedValueOnce([
        { pg_try_advisory_lock: true },
      ]);

      // Mock cleanup failure
      jest.spyOn(mockCommandBus, 'execute').mockRejectedValueOnce(new Error('Cleanup failed'));

      await expect(service.handleCleanup()).rejects.toThrow('Cleanup failed');

      // Verify lock was still released
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        'SELECT pg_advisory_unlock($1)',
        [2025030801],
      );

      // Verify error was logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Cleanup failed'),
        expect.anything(),
      );
    });

    it('should handle database error during lock acquisition', async () => {
      // Mock lock acquisition error
      jest.spyOn(mockDatabaseService, 'query').mockRejectedValueOnce(new Error('DB connection error'));

      await service.handleCleanup();

      // Verify cleanup was NOT executed
      expect(mockCommandBus.execute).not.toHaveBeenCalled();

      // Verify error was logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to acquire lock'),
        expect.anything(),
      );
    });

    it('should handle error during lock release', async () => {
      // Mock lock acquisition
      jest.spyOn(mockDatabaseService, 'query').mockResolvedValueOnce([
        { pg_try_advisory_lock: true },
      ]);

      // Mock lock release error
      jest.spyOn(mockDatabaseService, 'query').mockRejectedValueOnce(new Error('Release failed'));

      // Mock cleanup success
      jest.spyOn(mockCommandBus, 'execute').mockResolvedValueOnce({
        passwordResetTokensDeleted: 0,
        refreshTokensDeleted: 0,
        totalDeleted: 0,
      });

      await service.handleCleanup();

      // Verify error was logged but didn't throw
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to release lock'),
        expect.anything(),
      );
    });
  });

  describe('tryAcquireLock', () => {
    beforeEach(() => {
      jest.spyOn(mockConfigService, 'get').mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'CLEANUP_CRON_LOCK_ID') return 2025030801;
        return defaultValue;
      });

      service = new CleanupCronService(mockCommandBus, mockDatabaseService, mockConfigService);
    });

    it('should return true when lock is acquired', async () => {
      jest.spyOn(mockDatabaseService, 'query').mockResolvedValueOnce([
        { pg_try_advisory_lock: true },
      ]);

      // Access private method via any cast for testing
      const result = await (service as any).tryAcquireLock();

      expect(result).toBe(true);
    });

    it('should return false when lock is not acquired', async () => {
      jest.spyOn(mockDatabaseService, 'query').mockResolvedValueOnce([
        { pg_try_advisory_lock: false },
      ]);

      const result = await (service as any).tryAcquireLock();

      expect(result).toBe(false);
    });

    it('should return false when database returns empty result', async () => {
      jest.spyOn(mockDatabaseService, 'query').mockResolvedValueOnce([]);

      const result = await (service as any).tryAcquireLock();

      expect(result).toBe(false);
    });
  });

  describe('executeCleanup', () => {
    beforeEach(() => {
      jest.spyOn(mockConfigService, 'get').mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'CLEANUP_CRON_LOCK_ID') return 2025030801;
        return defaultValue;
      });

      service = new CleanupCronService(mockCommandBus, mockDatabaseService, mockConfigService);
    });

    it('should execute cleanup command and log results', async () => {
      jest.spyOn(mockCommandBus, 'execute').mockResolvedValueOnce({
        passwordResetTokensDeleted: 3,
        refreshTokensDeleted: 7,
        totalDeleted: 10,
      });

      await (service as any).executeCleanup();

      expect(mockCommandBus.execute).toHaveBeenCalledWith(
        expect.any(CleanupExpiredEntitiesCommand),
      );

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Cleanup completed successfully'),
      );
    });

    it('should throw error if cleanup command fails', async () => {
      jest.spyOn(mockCommandBus, 'execute').mockRejectedValueOnce(new Error('Command failed'));

      await expect((service as any).executeCleanup()).rejects.toThrow('Command failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Cleanup failed'),
        expect.anything(),
      );
    });
  });
});
