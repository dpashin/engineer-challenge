import { Module, Global, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (): Redis => {
        const logger = new Logger('Redis');

        const redis = new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD || undefined,
          db: parseInt(process.env.REDIS_DB || '0'),
          retryStrategy: (times: number) => {
            if (times > 5) {
              logger.error('Redis connection failed after multiple retries');
              return null;
            }
            const delay = Math.min(times * 50, 2000);
            return delay;
          },
        });

        redis.on('connect', () => {
          logger.log('Connected to Redis');
        });

        redis.on('error', (error) => {
          logger.error(`Redis error: ${error.message}`);
        });

        redis.on('close', () => {
          logger.warn('Redis connection closed');
        });

        return redis;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
