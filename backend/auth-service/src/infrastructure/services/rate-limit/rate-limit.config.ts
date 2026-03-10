import { Injectable } from '@nestjs/common';
import { RateLimitType } from './rate-limit.service';

export interface RateLimitEntry {
  limit: number;
  windowMs: number;
  description?: string;
}

export interface RateLimitConfig {
  limits: Record<RateLimitType, RateLimitEntry>;
}

export const RATE_LIMIT_CONFIG = Symbol('RATE_LIMIT_CONFIG');

/**
 * Конфигурация rate limiting для авторизации
 * Все значения в миллисекундах
 */
export const defaultRateLimitConfig: RateLimitConfig = {
  limits: {
    // 1. Login Attempts
    [RateLimitType.LOGIN_BY_EMAIL]: {
      limit: 5,
      windowMs: 15 * 60 * 1000, // 15 минут
      description: 'Неудачные попытки входа на аккаунт',
    },
    [RateLimitType.LOGIN_BY_IP]: {
      limit: 20,
      windowMs: 60 * 1000, // 1 минута
      description: 'Попытки входа с IP',
    },
    
    // 2. Registration
    [RateLimitType.REGISTER_BY_IP]: {
      limit: 5,
      windowMs: 60 * 60 * 1000, // 1 час
      description: 'Регистрации с IP',
    },
    [RateLimitType.REGISTER_BY_EMAIL]: {
      limit: 3,
      windowMs: 60 * 60 * 1000, // 1 час
      description: 'Регистрации на email',
    },
    
    // 3. Password Reset
    [RateLimitType.PASSWORD_RESET_BY_EMAIL]: {
      limit: 3,
      windowMs: 60 * 60 * 1000, // 1 час
      description: 'Запросы сброса пароля на email',
    },
    [RateLimitType.PASSWORD_RESET_BY_IP]: {
      limit: 10,
      windowMs: 60 * 60 * 1000, // 1 час
      description: 'Запросы сброса пароля с IP',
    },
    
    // 4. Token Management
    [RateLimitType.TOKEN_REFRESH]: {
      limit: 10,
      windowMs: 60 * 1000, // 1 минута
      description: 'Обновление токена',
    },
    
    // 5. Global API
    [RateLimitType.API_GLOBAL]: {
      limit: 100,
      windowMs: 60 * 1000, // 1 минута
      description: 'Глобальный лимит API',
    },
  },
};

@Injectable()
export class RateLimitConfigService {
  getConfig(): RateLimitConfig {
    return {
      limits: {
        [RateLimitType.LOGIN_BY_EMAIL]: {
          limit: parseInt(process.env.RATE_LIMIT_LOGIN_EMAIL || '5'),
          windowMs: parseInt(process.env.RATE_LIMIT_LOGIN_EMAIL_WINDOW || '900000'), // 15 min
        },
        [RateLimitType.LOGIN_BY_IP]: {
          limit: parseInt(process.env.RATE_LIMIT_LOGIN_IP || '20'),
          windowMs: parseInt(process.env.RATE_LIMIT_LOGIN_IP_WINDOW || '60000'), // 1 min
        },
        [RateLimitType.REGISTER_BY_IP]: {
          limit: parseInt(process.env.RATE_LIMIT_REGISTER_IP || '5'),
          windowMs: parseInt(process.env.RATE_LIMIT_REGISTER_IP_WINDOW || '3600000'), // 1 hour
        },
        [RateLimitType.REGISTER_BY_EMAIL]: {
          limit: parseInt(process.env.RATE_LIMIT_REGISTER_EMAIL || '3'),
          windowMs: parseInt(process.env.RATE_LIMIT_REGISTER_EMAIL_WINDOW || '3600000'), // 1 hour
        },
        [RateLimitType.PASSWORD_RESET_BY_EMAIL]: {
          limit: parseInt(process.env.RATE_LIMIT_RESET_EMAIL || '3'),
          windowMs: parseInt(process.env.RATE_LIMIT_RESET_EMAIL_WINDOW || '3600000'), // 1 hour
        },
        [RateLimitType.PASSWORD_RESET_BY_IP]: {
          limit: parseInt(process.env.RATE_LIMIT_RESET_IP || '10'),
          windowMs: parseInt(process.env.RATE_LIMIT_RESET_IP_WINDOW || '3600000'), // 1 hour
        },
        [RateLimitType.TOKEN_REFRESH]: {
          limit: parseInt(process.env.RATE_LIMIT_TOKEN_REFRESH || '10'),
          windowMs: parseInt(process.env.RATE_LIMIT_TOKEN_REFRESH_WINDOW || '60000'), // 1 min
        },
        [RateLimitType.API_GLOBAL]: {
          limit: parseInt(process.env.RATE_LIMIT_API_GLOBAL || '100'),
          windowMs: parseInt(process.env.RATE_LIMIT_API_GLOBAL_WINDOW || '60000'), // 1 min
        },
      },
    };
  }
}
