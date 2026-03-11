import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { Redis } from 'ioredis';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  database: {
    status: 'healthy' | 'unhealthy';
    message?: string;
    responseTimeMs?: number;
  };
  redis: {
    status: 'healthy' | 'unhealthy';
    message?: string;
    responseTimeMs?: number;
  };
  uptime: number;
  timestamp: string;
}

/**
 * Health Check Service
 * 
 * Проверяет состояние зависимостей:
 * - PostgreSQL (подключение и простой запрос)
 * - Redis (подключение и PING)
 */
@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly redis: Redis;
  private readonly startTime: number;

  constructor(
    private readonly db: DatabaseService,
    private readonly configService: ConfigService,
  ) {
    this.startTime = Date.now();
    
    // Инициализация Redis подключения для health check
    const redisUrl = this.configService.get<string>('REDIS_URL') 
      || `redis://${this.configService.get<string>('REDIS_HOST', 'localhost')}:${this.configService.get<string>('REDIS_PORT', '6379')}`;
    
    this.redis = new Redis(redisUrl, {
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 3) {
          return null; // Прекратить попытки
        }
        return Math.min(times * 50, 500);
      },
    });

    this.redis.on('error', (error) => {
      this.logger.warn(`Redis connection error: ${error.message}`);
    });
  }

  /**
   * Проверка здоровья всех зависимостей
   */
  async checkHealth(): Promise<HealthStatus> {
    const [databaseHealth, redisHealth] = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const databaseResult = databaseHealth.status === 'fulfilled' 
      ? databaseHealth.value 
      : { status: 'unhealthy' as const, message: databaseHealth.reason?.message || 'Unknown error' };
    
    const redisResult = redisHealth.status === 'fulfilled'
      ? redisHealth.value
      : { status: 'unhealthy' as const, message: redisHealth.reason?.message || 'Unknown error' };

    const overallStatus = this.determineOverallStatus(databaseResult, redisResult);

    return {
      status: overallStatus,
      database: databaseResult,
      redis: redisResult,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Проверка подключения к базе данных
   */
  async checkDatabase(): Promise<HealthStatus['database']> {
    const startTime = Date.now();
    
    try {
      // Простой запрос для проверки подключения
      await this.db.query('SELECT 1 as health_check');
      const responseTime = Date.now() - startTime;

      return {
        status: 'healthy',
        responseTimeMs: responseTime,
      };
    } catch (error) {
      this.logger.error(`Database health check failed: ${error.message}`);
      
      return {
        status: 'unhealthy',
        message: error.message,
      };
    }
  }

  /**
   * Проверка подключения к Redis
   */
  async checkRedis(): Promise<HealthStatus['redis']> {
    const startTime = Date.now();
    
    try {
      // Проверяем подключение через PING
      const result = await this.redis.ping();
      const responseTime = Date.now() - startTime;

      if (result === 'PONG') {
        return {
          status: 'healthy',
          responseTimeMs: responseTime,
        };
      }

      return {
        status: 'unhealthy',
        message: `Unexpected response: ${result}`,
      };
    } catch (error) {
      this.logger.warn(`Redis health check failed: ${error.message}`);
      
      return {
        status: 'unhealthy',
        message: error.message,
      };
    }
  }

  /**
   * Определение общего статуса
   */
  private determineOverallStatus(
    database: HealthStatus['database'],
    redis: HealthStatus['redis'],
  ): 'healthy' | 'unhealthy' | 'degraded' {
    if (database.status === 'healthy' && redis.status === 'healthy') {
      return 'healthy';
    }

    if (database.status === 'unhealthy' && redis.status === 'unhealthy') {
      return 'unhealthy';
    }

    // Один из сервисов нездоров - degraded status
    return 'degraded';
  }

  /**
   * Простая проверка (только для load balancer)
   */
  async isAlive(): Promise<boolean> {
    return Date.now() - this.startTime < Number.MAX_SAFE_INTEGER;
  }

  /**
   * Глубокая проверка здоровья
   */
  async isReady(): Promise<boolean> {
    const health = await this.checkHealth();
    return health.status === 'healthy';
  }

  /**
   * Очистка ресурсов
   */
  onModuleDestroy() {
    this.redis.disconnect();
  }
}
