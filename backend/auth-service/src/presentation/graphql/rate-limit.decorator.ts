import { SetMetadata } from '@nestjs/common';
import { RateLimitType } from '../../infrastructure/services/rate-limit/rate-limit.service';

export const RATE_LIMIT_METADATA_KEY = 'rate_limit';

export interface RateLimitOptions {
  type: RateLimitType;
  identifierArg: number | string; // индекс аргумента или имя свойства
  identifierExtractor?: (...args: unknown[]) => string;
}

/**
 * Декоратор для rate limiting GraphQL мутаций
 * 
 * @param type Тип лимита
 * @param identifierArg Индекс аргумента или имя свойства для извлечения идентификатора
 * @param identifierExtractor Кастомная функция извлечения идентификатора
 */
export const RateLimit = (
  type: RateLimitType,
  identifierArg: number | string,
  identifierExtractor?: (...args: unknown[]) => string,
) => SetMetadata(RATE_LIMIT_METADATA_KEY, { type, identifierArg, identifierExtractor });
