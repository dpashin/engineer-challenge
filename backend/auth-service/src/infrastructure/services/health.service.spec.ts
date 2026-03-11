import { HealthService } from './health.service';
import { DatabaseService } from '../database/database.service';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { Logger } from '@nestjs/common';

jest.mock('ioredis', () => {
  return {
    Redis: jest.fn().mockImplementation(() => ({
      ping: jest.fn(),
      on: jest.fn(),
      disconnect: jest.fn(),
      connect: jest.fn(),
    })),
  };
});

describe('HealthService', () => {
  let service: HealthService;
  let mockDatabaseService: DatabaseService;
  let mockConfigService: ConfigService;
  let mockRedis: Redis;
  let mockLogger: Logger;

  beforeEach(() => {
    mockDatabaseService = {
      query: jest.fn(),
    } as unknown as DatabaseService;

    mockConfigService = {
      get: jest.fn(),
    } as unknown as ConfigService;

    mockRedis = {
      ping: jest.fn(),
      on: jest.fn(),
      disconnect: jest.fn(),
      connect: jest.fn(),
    } as unknown as Redis;

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

    // Mock Redis constructor
    (Redis as jest.MockedClass<typeof Redis>).mockImplementation(() => mockRedis);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with Redis URL from config', () => {
      jest.spyOn(mockConfigService, 'get').mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'REDIS_URL') return 'redis://localhost:6379';
        return defaultValue;
      });

      service = new HealthService(mockDatabaseService, mockConfigService);

      expect(Redis).toHaveBeenCalledWith(
        'redis://localhost:6379',
        expect.objectContaining({
          lazyConnect: true,
        }),
      );
    });

    it('should construct Redis URL from host and port if REDIS_URL not provided', () => {
      jest.spyOn(mockConfigService, 'get').mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'REDIS_URL') return undefined;
        if (key === 'REDIS_HOST') return 'custom-host';
        if (key === 'REDIS_PORT') return '1234';
        return defaultValue;
      });

      service = new HealthService(mockDatabaseService, mockConfigService);

      expect(Redis).toHaveBeenCalledWith(
        'redis://custom-host:1234',
        expect.anything(),
      );
    });

    it('should use default Redis host and port if not provided', () => {
      jest.spyOn(mockConfigService, 'get').mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'REDIS_URL') return undefined;
        return defaultValue;
      });

      service = new HealthService(mockDatabaseService, mockConfigService);

      expect(Redis).toHaveBeenCalledWith(
        'redis://localhost:6379',
        expect.anything(),
      );
    });

    it('should set up Redis error handler', () => {
      jest.spyOn(mockConfigService, 'get').mockReturnValue('redis://localhost:6379');

      service = new HealthService(mockDatabaseService, mockConfigService);

      expect(mockRedis.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('checkHealth', () => {
    beforeEach(() => {
      jest.spyOn(mockConfigService, 'get').mockReturnValue('redis://localhost:6379');
      service = new HealthService(mockDatabaseService, mockConfigService);
    });

    it('should return healthy status when all dependencies are healthy', async () => {
      jest.spyOn(mockDatabaseService, 'query').mockResolvedValueOnce([{ health_check: 1 }]);
      jest.spyOn(mockRedis, 'ping').mockResolvedValueOnce('PONG');

      const result = await service.checkHealth();

      expect(result.status).toBe('healthy');
      expect(result.database.status).toBe('healthy');
      expect(result.redis.status).toBe('healthy');
      expect(result.uptime).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should return unhealthy status when all dependencies are unhealthy', async () => {
      jest.spyOn(mockDatabaseService, 'query').mockRejectedValueOnce(new Error('DB error'));
      jest.spyOn(mockRedis, 'ping').mockRejectedValueOnce(new Error('Redis error'));

      const result = await service.checkHealth();

      expect(result.status).toBe('unhealthy');
      expect(result.database.status).toBe('unhealthy');
      expect(result.redis.status).toBe('unhealthy');
    });

    it('should return degraded status when database is unhealthy but redis is healthy', async () => {
      jest.spyOn(mockDatabaseService, 'query').mockRejectedValueOnce(new Error('DB error'));
      jest.spyOn(mockRedis, 'ping').mockResolvedValueOnce('PONG');

      const result = await service.checkHealth();

      expect(result.status).toBe('degraded');
      expect(result.database.status).toBe('unhealthy');
      expect(result.redis.status).toBe('healthy');
    });

    it('should return degraded status when database is healthy but redis is unhealthy', async () => {
      jest.spyOn(mockDatabaseService, 'query').mockResolvedValueOnce([{ health_check: 1 }]);
      jest.spyOn(mockRedis, 'ping').mockRejectedValueOnce(new Error('Redis error'));

      const result = await service.checkHealth();

      expect(result.status).toBe('degraded');
      expect(result.database.status).toBe('healthy');
      expect(result.redis.status).toBe('unhealthy');
    });

    it('should return unhealthy status when database check throws', async () => {
      jest.spyOn(mockDatabaseService, 'query').mockRejectedValueOnce(new Error('Connection failed'));
      jest.spyOn(mockRedis, 'ping').mockResolvedValueOnce('PONG');

      const result = await service.checkHealth();

      expect(result.database.status).toBe('unhealthy');
      expect(result.database.message).toBe('Connection failed');
    });

    it('should return unhealthy status when redis check throws', async () => {
      jest.spyOn(mockDatabaseService, 'query').mockResolvedValueOnce([{ health_check: 1 }]);
      jest.spyOn(mockRedis, 'ping').mockRejectedValueOnce(new Error('Connection refused'));

      const result = await service.checkHealth();

      expect(result.redis.status).toBe('unhealthy');
      expect(result.redis.message).toBe('Connection refused');
    });

    it('should handle unexpected redis response', async () => {
      jest.spyOn(mockDatabaseService, 'query').mockResolvedValueOnce([{ health_check: 1 }]);
      jest.spyOn(mockRedis, 'ping').mockResolvedValueOnce('ERROR');

      const result = await service.checkHealth();

      expect(result.redis.status).toBe('unhealthy');
      expect(result.redis.message).toBe('Unexpected response: ERROR');
    });
  });

  describe('checkDatabase', () => {
    beforeEach(() => {
      jest.spyOn(mockConfigService, 'get').mockReturnValue('redis://localhost:6379');
      service = new HealthService(mockDatabaseService, mockConfigService);
    });

    it('should return healthy status when database query succeeds', async () => {
      jest.spyOn(mockDatabaseService, 'query').mockResolvedValueOnce([{ health_check: 1 }]);

      const result = await service.checkDatabase();

      expect(result.status).toBe('healthy');
      expect(result.responseTimeMs).toBeDefined();
      expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should return unhealthy status when database query fails', async () => {
      jest.spyOn(mockDatabaseService, 'query').mockRejectedValueOnce(new Error('Connection timeout'));

      const result = await service.checkDatabase();

      expect(result.status).toBe('unhealthy');
      expect(result.message).toBe('Connection timeout');
    });

    it('should log error when database check fails', async () => {
      jest.spyOn(mockDatabaseService, 'query').mockRejectedValueOnce(new Error('DB error'));

      await service.checkDatabase();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Database health check failed'),
      );
    });
  });

  describe('checkRedis', () => {
    beforeEach(() => {
      jest.spyOn(mockConfigService, 'get').mockReturnValue('redis://localhost:6379');
      service = new HealthService(mockDatabaseService, mockConfigService);
    });

    it('should return healthy status when redis ping returns PONG', async () => {
      jest.spyOn(mockRedis, 'ping').mockResolvedValueOnce('PONG');

      const result = await service.checkRedis();

      expect(result.status).toBe('healthy');
      expect(result.responseTimeMs).toBeDefined();
      expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should return unhealthy status when redis ping fails', async () => {
      jest.spyOn(mockRedis, 'ping').mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const result = await service.checkRedis();

      expect(result.status).toBe('unhealthy');
      expect(result.message).toBe('ECONNREFUSED');
    });

    it('should log warning when redis check fails', async () => {
      jest.spyOn(mockRedis, 'ping').mockRejectedValueOnce(new Error('Redis error'));

      await service.checkRedis();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Redis health check failed'),
      );
    });
  });

  describe('determineOverallStatus', () => {
    beforeEach(() => {
      jest.spyOn(mockConfigService, 'get').mockReturnValue('redis://localhost:6379');
      service = new HealthService(mockDatabaseService, mockConfigService);
    });

    it('should return healthy when both database and redis are healthy', () => {
      const result = (service as any).determineOverallStatus(
        { status: 'healthy' },
        { status: 'healthy' },
      );
      expect(result).toBe('healthy');
    });

    it('should return unhealthy when both database and redis are unhealthy', () => {
      const result = (service as any).determineOverallStatus(
        { status: 'unhealthy' },
        { status: 'unhealthy' },
      );
      expect(result).toBe('unhealthy');
    });

    it('should return degraded when database is healthy but redis is unhealthy', () => {
      const result = (service as any).determineOverallStatus(
        { status: 'healthy' },
        { status: 'unhealthy' },
      );
      expect(result).toBe('degraded');
    });

    it('should return degraded when database is unhealthy but redis is healthy', () => {
      const result = (service as any).determineOverallStatus(
        { status: 'unhealthy' },
        { status: 'healthy' },
      );
      expect(result).toBe('degraded');
    });
  });

  describe('isAlive', () => {
    beforeEach(() => {
      jest.spyOn(mockConfigService, 'get').mockReturnValue('redis://localhost:6379');
      service = new HealthService(mockDatabaseService, mockConfigService);
    });

    it('should return true when service is running', async () => {
      const result = await service.isAlive();
      expect(result).toBe(true);
    });
  });

  describe('isReady', () => {
    beforeEach(() => {
      jest.spyOn(mockConfigService, 'get').mockReturnValue('redis://localhost:6379');
      service = new HealthService(mockDatabaseService, mockConfigService);
    });

    it('should return true when all health checks pass', async () => {
      jest.spyOn(service, 'checkHealth').mockResolvedValueOnce({
        status: 'healthy',
        database: { status: 'healthy' },
        redis: { status: 'healthy' },
        uptime: 100,
        timestamp: new Date().toISOString(),
      });

      const result = await service.isReady();
      expect(result).toBe(true);
    });

    it('should return false when health status is not healthy', async () => {
      jest.spyOn(service, 'checkHealth').mockResolvedValueOnce({
        status: 'degraded',
        database: { status: 'healthy' },
        redis: { status: 'unhealthy' },
        uptime: 100,
        timestamp: new Date().toISOString(),
      });

      const result = await service.isReady();
      expect(result).toBe(false);
    });
  });

  describe('onModuleDestroy', () => {
    beforeEach(() => {
      jest.spyOn(mockConfigService, 'get').mockReturnValue('redis://localhost:6379');
      service = new HealthService(mockDatabaseService, mockConfigService);
    });

    it('should disconnect redis on module destroy', () => {
      service.onModuleDestroy();
      expect(mockRedis.disconnect).toHaveBeenCalled();
    });
  });
});
