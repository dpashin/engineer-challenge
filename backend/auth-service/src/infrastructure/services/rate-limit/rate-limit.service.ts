import { Injectable, Logger, Inject } from '@nestjs/common';
import { Redis } from 'ioredis';
import { RateLimitConfig, RATE_LIMIT_CONFIG } from './rate-limit.config';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

export interface RateLimitKey {
  key: string;
  type: RateLimitType;
}

export enum RateLimitType {
  LOGIN_BY_EMAIL = 'login:by_email',
  LOGIN_BY_IP = 'login:by_ip',
  REGISTER_BY_IP = 'register:by_ip',
  PASSWORD_RESET_BY_EMAIL = 'password_reset:by_email',
  PASSWORD_RESET_BY_IP = 'password_reset:by_ip',
  REGISTER_BY_EMAIL = 'register:by_email',
  TOKEN_REFRESH = 'token:refresh',
  API_GLOBAL = 'api:global',
}

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);

  constructor(
    private readonly redis: Redis,
    @Inject(RATE_LIMIT_CONFIG) private readonly config: RateLimitConfig,
  ) {}

  /**
   * Проверка лимита с использованием sliding window log
   */
  async checkLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    const multi = this.redis.multi();
    
    // Удаляем старые записи за пределами окна
    multi.zremrangebyscore(key, 0, windowStart);
    
    // Добавляем текущий запрос
    multi.zadd(key, now.toString(), `${now}-${Math.random()}`);
    
    // Считаем количество запросов в окне
    multi.zcard(key);
    
    // Устанавливаем TTL для ключа
    multi.expire(key, Math.ceil(windowMs / 1000));

    const results = await multi.exec();

    if (!results) {
      throw new Error('Failed to execute Redis multi command');
    }

    const count = (results[2][1] as number);
    const remaining = Math.max(0, limit - count);
    const resetAt = now + windowMs;
    
    if (count > limit) {
      // Получаем время до удаления самого старого запроса
      const oldestEntries = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
      if (oldestEntries.length >= 2) {
        const oldestTimestamp = parseInt(oldestEntries[1]);
        const retryAfter = Math.ceil((oldestTimestamp + windowMs - now) / 1000);
        
        this.logger.warn(
          `Rate limit exceeded for key: ${key}, count: ${count}, limit: ${limit}, retryAfter: ${retryAfter}s`,
        );
        
        return {
          allowed: false,
          remaining: 0,
          resetAt,
          retryAfter,
        };
      }
      
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter: Math.ceil(windowMs / 1000),
      };
    }
    
    return {
      allowed: true,
      remaining,
      resetAt,
    };
  }

  /**
   * Проверка лимита для конкретного типа
   */
  async checkLimitByType(
    type: RateLimitType,
    identifier: string,
  ): Promise<RateLimitResult> {
    const limitConfig = this.config.limits[type];
    if (!limitConfig) {
      this.logger.warn(`No rate limit config for type: ${type}`);
      return { allowed: true, remaining: Number.MAX_SAFE_INTEGER, resetAt: Date.now() };
    }
    
    const key = this.buildKey(type, identifier);
    return this.checkLimit(key, limitConfig.limit, limitConfig.windowMs);
  }

  /**
   * Построение ключа для Redis
   */
  private buildKey(type: RateLimitType, identifier: string): string {
    return `ratelimit:${type}:${this.normalizeIdentifier(identifier)}`;
  }

  /**
   * Нормализация идентификатора (email -> lowercase, IP -> без пробелов)
   */
  private normalizeIdentifier(identifier: string): string {
    return identifier.toLowerCase().trim();
  }

  /**
   * Сброс лимита для ключа
   */
  async resetLimit(key: string): Promise<void> {
    await this.redis.del(key);
    this.logger.debug(`Rate limit reset for key: ${key}`);
  }

  /**
   * Сброс лимита по типу и идентификатору
   */
  async resetLimitByType(type: RateLimitType, identifier: string): Promise<void> {
    const key = this.buildKey(type, identifier);
    await this.resetLimit(key);
  }

  /**
   * Получение оставшегося количества запросов
   */
  async getRemainingCount(key: string, limit: number, windowMs: number): Promise<number> {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    await this.redis.zremrangebyscore(key, 0, windowStart);
    const count = await this.redis.zcard(key);
    
    return Math.max(0, limit - count);
  }
}
