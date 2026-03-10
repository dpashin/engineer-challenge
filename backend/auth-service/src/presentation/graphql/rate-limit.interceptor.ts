import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { GqlExecutionContext } from '@nestjs/graphql';
import {
  RateLimitService,
  RateLimitType,
  RateLimitResult,
} from '../../infrastructure/services/rate-limit';
import {
  RATE_LIMIT_METADATA_KEY,
  RateLimitOptions,
} from './rate-limit.decorator';
import { RateLimitExceededException } from '../../infrastructure/services/rate-limit/rate-limit.exception';

@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RateLimitInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimitService: RateLimitService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const rateLimitOptions = this.reflector.get<RateLimitOptions>(
      RATE_LIMIT_METADATA_KEY,
      context.getHandler(),
    );

    if (!rateLimitOptions) {
      return next.handle();
    }

    const identifier = this.extractIdentifier(context, rateLimitOptions);
    
    if (!identifier) {
      this.logger.warn(`Could not extract identifier for rate limit: ${rateLimitOptions.type}`);
      return next.handle();
    }

    const result = await this.rateLimitService.checkLimitByType(
      rateLimitOptions.type,
      identifier,
    );

    if (!result.allowed) {
      throw new RateLimitExceededException(
        `Too many requests. Please try again in ${result.retryAfter} seconds.`,
        result.retryAfter,
      );
    }

    return next.handle().pipe(
      catchError((error) => {
        if (error instanceof RateLimitExceededException) {
          return throwError(() => error);
        }
        throw error;
      }),
    );
  }

  private extractIdentifier(
    context: ExecutionContext,
    options: RateLimitOptions,
  ): string | null {
    // Если есть кастомный экстрактор, используем его
    if (options.identifierExtractor) {
      const args = context.getArgs();
      return options.identifierExtractor(...args);
    }

    // Для GraphQL получаем аргументы мутации
    const gqlContext = GqlExecutionContext.create(context);
    const args = gqlContext.getArgs();

    // Если identifierArg - число, берем по индексу
    if (typeof options.identifierArg === 'number') {
      const argKeys = Object.keys(args);
      if (options.identifierArg < argKeys.length) {
        const argValue = args[argKeys[options.identifierArg]];
        return this.extractIdentifierFromValue(argValue);
      }
    }

    // Если identifierArg - строка, берем по имени свойства
    if (typeof options.identifierArg === 'string') {
      const argValue = args[options.identifierArg];
      return this.extractIdentifierFromValue(argValue);
    }

    return null;
  }

  private extractIdentifierFromValue(value: unknown): string | null {
    if (typeof value === 'string') {
      return value;
    }

    if (value && typeof value === 'object') {
      // Пытаемся найти email или ip в объекте
      const obj = value as Record<string, unknown>;
      if (typeof obj.email === 'string') {
        return obj.email;
      }
      if (typeof obj.ip === 'string') {
        return obj.ip;
      }
      if (typeof obj.ipAddress === 'string') {
        return obj.ipAddress;
      }
    }

    return null;
  }
}
