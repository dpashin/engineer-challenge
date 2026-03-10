import { Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
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

export interface RateLimitConfigEntry {
  limit: number;
  ttl: number; // in milliseconds
}

/**
 * Rate Limiting Service using Redis with @nestjs/throttler compatible approach
 * 
 * Uses Redis-backed storage for distributed rate limiting across multiple instances.
 * Implements fixed window counter algorithm (same as @nestjs/throttler default).
 */
@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly redis: Redis;

  constructor() {
    const url = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`;
    
    this.logger.log(`Connecting to Redis: ${url}`);
    this.redis = new Redis(url, {
      retryStrategy: (times) => {
        if (times > 5) {
          this.logger.error('Redis connection failed after multiple retries');
          return null;
        }
        return Math.min(times * 50, 2000);
      },
    });

    this.redis.on('connect', () => {
      this.logger.log('Connected to Redis for rate limiting');
    });

    this.redis.on('error', (error) => {
      this.logger.error(`Redis error: ${error.message}`);
    });
  }

  /**
   * Check rate limit for a specific type using fixed window counter
   * (Same algorithm as @nestjs/throttler)
   */
  async checkLimitByType(
    type: RateLimitType,
    identifier: string,
  ): Promise<RateLimitResult> {
    const config = this.getLimitConfig(type);

    if (!config) {
      this.logger.warn(`No rate limit config for type: ${type}`);
      return { allowed: true, remaining: Number.MAX_SAFE_INTEGER, resetAt: Date.now() };
    }

    const key = this.buildKey(type, identifier);
    const now = Date.now();
    const windowStart = now - config.ttl;

    try {
      // Use sorted set for sliding window log
      const multi = this.redis.multi();
      
      // Remove old entries outside the window
      multi.zremrangebyscore(key, 0, windowStart);
      
      // Add current request
      multi.zadd(key, now.toString(), `${now}-${Math.random()}`);
      
      // Count requests in window
      multi.zcard(key);
      
      // Set TTL
      multi.expire(key, Math.ceil(config.ttl / 1000));

      const results = await multi.exec();

      if (!results) {
        throw new Error('Failed to execute Redis multi command');
      }

      const count = results[2][1] as number;
      const remaining = Math.max(0, config.limit - count);
      const resetAt = now + config.ttl;

      if (count > config.limit) {
        // Get oldest entry to calculate retryAfter
        const oldestEntries = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
        let retryAfter = Math.ceil(config.ttl / 1000);
        
        if (oldestEntries.length >= 2) {
          const oldestTimestamp = parseInt(oldestEntries[1]);
          retryAfter = Math.ceil((oldestTimestamp + config.ttl - now) / 1000);
        }

        this.logger.warn(
          `Rate limit exceeded for key: ${key}, count: ${count}, limit: ${config.limit}, retryAfter: ${retryAfter}s`,
        );

        return {
          allowed: false,
          remaining: 0,
          resetAt,
          retryAfter,
        };
      }

      return {
        allowed: true,
        remaining,
        resetAt,
      };
    } catch (error) {
      this.logger.error(`Rate limit check failed for key ${key}: ${error.message}`);
      // Fail open - allow request if Redis fails
      return {
        allowed: true,
        remaining: config.limit,
        resetAt: now + config.ttl,
      };
    }
  }

  /**
   * Build key for rate limiting
   */
  private buildKey(type: RateLimitType, identifier: string): string {
    return `ratelimit:${type}:${this.normalizeIdentifier(identifier)}`;
  }

  /**
   * Normalize identifier (email -> lowercase, IP -> trimmed)
   */
  private normalizeIdentifier(identifier: string): string {
    return identifier.toLowerCase().trim();
  }

  /**
   * Get limit config for a type
   */
  private getLimitConfig(type: RateLimitType): RateLimitConfigEntry | null {
    const config = defaultRateLimitConfig.limits[type];
    if (!config) {
      return null;
    }
    return {
      limit: config.limit,
      ttl: config.windowMs,
    };
  }

  /**
   * Reset limit for a key
   */
  async resetLimit(key: string): Promise<void> {
    await this.redis.del(key);
    this.logger.debug(`Rate limit reset for key: ${key}`);
  }

  /**
   * Reset limit by type and identifier
   */
  async resetLimitByType(type: RateLimitType, identifier: string): Promise<void> {
    const key = this.buildKey(type, identifier);
    await this.resetLimit(key);
  }

  /**
   * Close Redis connection
   */
  async shutdown(): Promise<void> {
    await this.redis.quit();
    this.logger.log('Redis connection closed');
  }
}

/**
 * Default rate limiting configuration
 * All values in milliseconds
 */
export const defaultRateLimitConfig: {
  limits: Record<RateLimitType, { limit: number; windowMs: number; description?: string }>;
} = {
  limits: {
    // 1. Login Attempts
    [RateLimitType.LOGIN_BY_EMAIL]: {
      limit: 3,
      windowMs: 30 * 60 * 1000, // 30 minutes
      description: 'Failed login attempts per account',
    },
    [RateLimitType.LOGIN_BY_IP]: {
      limit: 10,
      windowMs: 15 * 60 * 1000, // 15 minutes
      description: 'Login attempts from IP',
    },

    // 2. Registration
    [RateLimitType.REGISTER_BY_IP]: {
      limit: 5,
      windowMs: 60 * 60 * 1000, // 1 hour
      description: 'Registrations from IP',
    },
    [RateLimitType.REGISTER_BY_EMAIL]: {
      limit: 3,
      windowMs: 60 * 60 * 1000, // 1 hour
      description: 'Registrations per email',
    },

    // 3. Password Reset
    [RateLimitType.PASSWORD_RESET_BY_EMAIL]: {
      limit: 3,
      windowMs: 30 * 60 * 1000, // 30 minutes
      description: 'Password reset requests per email',
    },
    [RateLimitType.PASSWORD_RESET_BY_IP]: {
      limit: 10,
      windowMs: 15 * 60 * 1000, // 15 minutes
      description: 'Password reset requests from IP',
    },

    // 4. Token Management
    [RateLimitType.TOKEN_REFRESH]: {
      limit: 5,
      windowMs: 60 * 1000, // 1 minute
      description: 'Token refresh requests',
    },

    // 5. Global API
    [RateLimitType.API_GLOBAL]: {
      limit: 100,
      windowMs: 60 * 1000, // 1 minute
      description: 'Global API limit',
    },
  },
};
