import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, of, throwError } from 'rxjs';
import { RateLimitInterceptor } from './rate-limit.interceptor';
import { RateLimitService, RateLimitResult } from '../../infrastructure/services/rate-limit';
import { RateLimitExceededException } from '../../infrastructure/services/rate-limit/rate-limit.exception';
import { RATE_LIMIT_METADATA_KEY, RateLimitOptions } from './rate-limit.decorator';
import { RateLimitType } from '../../infrastructure/services/rate-limit/rate-limit-type.enum';
import { GqlExecutionContext } from '@nestjs/graphql';

describe('RateLimitInterceptor', () => {
  let interceptor: RateLimitInterceptor;
  let reflector: Reflector;
  let rateLimitService: RateLimitService;

  const mockRateLimitResult: RateLimitResult = {
    allowed: true,
    remaining: 5,
    resetAt: Date.now() + 3600000,
  };

  const mockRateLimitExceededResult: RateLimitResult = {
    allowed: false,
    remaining: 0,
    resetAt: Date.now() + 3600000,
    retryAfter: 60,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitInterceptor,
        {
          provide: Reflector,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: RateLimitService,
          useValue: {
            checkLimitByType: jest.fn(),
          },
        },
      ],
    }).compile();

    interceptor = module.get<RateLimitInterceptor>(RateLimitInterceptor);
    reflector = module.get<Reflector>(Reflector);
    rateLimitService = module.get<RateLimitService>(RateLimitService);

    jest.clearAllMocks();
  });

  describe('intercept', () => {
    const mockCallHandler: CallHandler = {
      handle: jest.fn().mockReturnValue(of('test response')),
    };

    const createMockGqlArgs = (argsObj: Record<string, unknown>) => argsObj;

    const createMockExecutionContext = (
      handlerMetadata?: RateLimitOptions,
      gqlArgs: Record<string, unknown> = {},
    ): ExecutionContext => {
      const mockGqlContext = {
        getArgs: jest.fn().mockReturnValue(gqlArgs),
        getArgByIndex: jest.fn(),
        getType: jest.fn().mockReturnValue('graphql'),
      };

      jest.spyOn(GqlExecutionContext, 'create').mockReturnValue(mockGqlContext as any);

      return {
        getHandler: jest.fn().mockReturnValue(() => {}),
        getClass: jest.fn().mockReturnValue(class {}),
        getArgs: jest.fn().mockReturnValue([]),
        getArgByIndex: jest.fn(),
        getType: jest.fn().mockReturnValue('graphql'),
        switchToRpc: jest.fn(),
        switchToHttp: jest.fn(),
        switchToWs: jest.fn(),
      } as unknown as ExecutionContext;
    };

    it('should pass through when no rate limit metadata', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);

      const context = createMockExecutionContext();
      const result = await interceptor.intercept(context, mockCallHandler);

      expect(reflector.get).toHaveBeenCalledWith(
        RATE_LIMIT_METADATA_KEY,
        expect.any(Function),
      );
      expect(rateLimitService.checkLimitByType).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should pass through when rate limit allows', async () => {
      const options: RateLimitOptions = {
        type: RateLimitType.LOGIN_BY_EMAIL,
        identifierArg: 'email',
      };

      jest.spyOn(reflector, 'get').mockReturnValue(options);
      jest
        .spyOn(rateLimitService, 'checkLimitByType')
        .mockResolvedValue(mockRateLimitResult);

      const context = createMockExecutionContext(options, createMockGqlArgs({
        email: 'test@example.com',
        password: 'password123',
      }));
      const result = await interceptor.intercept(context, mockCallHandler);

      expect(rateLimitService.checkLimitByType).toHaveBeenCalledWith(
        RateLimitType.LOGIN_BY_EMAIL,
        'test@example.com',
      );
      expect(result).toBeDefined();
    });

    it('should throw RateLimitExceededException when rate limit exceeded', async () => {
      const options: RateLimitOptions = {
        type: RateLimitType.LOGIN_BY_EMAIL,
        identifierArg: 'email',
      };

      jest.spyOn(reflector, 'get').mockReturnValue(options);
      jest
        .spyOn(rateLimitService, 'checkLimitByType')
        .mockResolvedValue(mockRateLimitExceededResult);

      const context = createMockExecutionContext(options, createMockGqlArgs({
        email: 'test@example.com',
        password: 'password123',
      }));

      await expect(interceptor.intercept(context, mockCallHandler)).rejects.toThrow(
        RateLimitExceededException,
      );
      await expect(interceptor.intercept(context, mockCallHandler)).rejects.toThrow(
        'Too many requests. Please try again in 60 seconds.',
      );
    });

    it('should pass through when identifier cannot be extracted', async () => {
      const options: RateLimitOptions = {
        type: RateLimitType.LOGIN_BY_EMAIL,
        identifierArg: 'nonexistent',
      };

      jest.spyOn(reflector, 'get').mockReturnValue(options);

      const context = createMockExecutionContext(options, createMockGqlArgs({
        email: 'test@example.com',
        password: 'password123',
      }));
      const result = await interceptor.intercept(context, mockCallHandler);

      expect(rateLimitService.checkLimitByType).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should use custom identifierExtractor when provided', async () => {
      const customExtractor = jest.fn().mockReturnValue('extracted@example.com');

      const options: RateLimitOptions = {
        type: RateLimitType.LOGIN_BY_EMAIL,
        identifierArg: 0,
        identifierExtractor: customExtractor,
      };

      jest.spyOn(reflector, 'get').mockReturnValue(options);
      jest
        .spyOn(rateLimitService, 'checkLimitByType')
        .mockResolvedValue(mockRateLimitResult);

      const context = createMockExecutionContext(options, createMockGqlArgs({
        email: 'custom@example.com',
        password: 'password123',
      }));
      const result = await interceptor.intercept(context, mockCallHandler);

      expect(customExtractor).toHaveBeenCalled();
      expect(rateLimitService.checkLimitByType).toHaveBeenCalledWith(
        RateLimitType.LOGIN_BY_EMAIL,
        'extracted@example.com',
      );
      expect(result).toBeDefined();
    });

    it('should extract identifier by string property name', async () => {
      const options: RateLimitOptions = {
        type: RateLimitType.REGISTER_BY_EMAIL,
        identifierArg: 'email',
      };

      jest.spyOn(reflector, 'get').mockReturnValue(options);
      jest
        .spyOn(rateLimitService, 'checkLimitByType')
        .mockResolvedValue(mockRateLimitResult);

      const context = createMockExecutionContext(options, createMockGqlArgs({
        email: 'test@example.com',
        password: 'password123',
        ipAddress: '127.0.0.1',
      }));
      const result = await interceptor.intercept(context, mockCallHandler);

      expect(rateLimitService.checkLimitByType).toHaveBeenCalledWith(
        RateLimitType.REGISTER_BY_EMAIL,
        'test@example.com',
      );
      expect(result).toBeDefined();
    });

    it('should extract identifier by numeric index', async () => {
      const options: RateLimitOptions = {
        type: RateLimitType.LOGIN_BY_IP,
        identifierArg: 0,
      };

      jest.spyOn(reflector, 'get').mockReturnValue(options);
      jest
        .spyOn(rateLimitService, 'checkLimitByType')
        .mockResolvedValue(mockRateLimitResult);

      const context = createMockExecutionContext(options, createMockGqlArgs({
        ipAddress: '127.0.0.1',
        email: 'test@example.com',
      }));
      const result = await interceptor.intercept(context, mockCallHandler);

      expect(rateLimitService.checkLimitByType).toHaveBeenCalledWith(
        RateLimitType.LOGIN_BY_IP,
        '127.0.0.1',
      );
      expect(result).toBeDefined();
    });

    it('should extract email from object argument', async () => {
      const options: RateLimitOptions = {
        type: RateLimitType.LOGIN_BY_EMAIL,
        identifierArg: 0,
      };

      jest.spyOn(reflector, 'get').mockReturnValue(options);
      jest
        .spyOn(rateLimitService, 'checkLimitByType')
        .mockResolvedValue(mockRateLimitResult);

      const context = createMockExecutionContext(options, createMockGqlArgs({
        email: 'object@example.com',
        password: 'pass123',
      }));
      const result = await interceptor.intercept(context, mockCallHandler);

      expect(rateLimitService.checkLimitByType).toHaveBeenCalledWith(
        RateLimitType.LOGIN_BY_EMAIL,
        'object@example.com',
      );
      expect(result).toBeDefined();
    });

    it('should extract ipAddress from object argument', async () => {
      const options: RateLimitOptions = {
        type: RateLimitType.LOGIN_BY_IP,
        identifierArg: 'ipAddress',
      };

      jest.spyOn(reflector, 'get').mockReturnValue(options);
      jest
        .spyOn(rateLimitService, 'checkLimitByType')
        .mockResolvedValue(mockRateLimitResult);

      const context = createMockExecutionContext(options, createMockGqlArgs({
        ipAddress: '192.168.1.1',
        email: 'test@example.com',
      }));
      const result = await interceptor.intercept(context, mockCallHandler);

      expect(rateLimitService.checkLimitByType).toHaveBeenCalledWith(
        RateLimitType.LOGIN_BY_IP,
        '192.168.1.1',
      );
      expect(result).toBeDefined();
    });

    it('should extract ip from object argument', async () => {
      const options: RateLimitOptions = {
        type: RateLimitType.REGISTER_BY_IP,
        identifierArg: 'ip',
      };

      jest.spyOn(reflector, 'get').mockReturnValue(options);
      jest
        .spyOn(rateLimitService, 'checkLimitByType')
        .mockResolvedValue(mockRateLimitResult);

      const context = createMockExecutionContext(options, createMockGqlArgs({
        ip: '10.0.0.1',
        email: 'test@example.com',
      }));
      const result = await interceptor.intercept(context, mockCallHandler);

      expect(rateLimitService.checkLimitByType).toHaveBeenCalledWith(
        RateLimitType.REGISTER_BY_IP,
        '10.0.0.1',
      );
      expect(result).toBeDefined();
    });

    it('should handle RateLimitExceededException from next.handle()', (done) => {
      const options: RateLimitOptions = {
        type: RateLimitType.LOGIN_BY_EMAIL,
        identifierArg: 'email',
      };

      jest.spyOn(reflector, 'get').mockReturnValue(options);
      jest
        .spyOn(rateLimitService, 'checkLimitByType')
        .mockResolvedValue(mockRateLimitResult);

      const error = new RateLimitExceededException('Rate limited', 30);
      const mockErrorHandler: CallHandler = {
        handle: jest.fn().mockReturnValue(throwError(() => error)),
      };

      const context = createMockExecutionContext(options, createMockGqlArgs({
        email: 'test@example.com',
        password: 'password123',
      }));

      interceptor.intercept(context, mockErrorHandler).then((obs) => {
        obs.subscribe({
          error: (err: Error) => {
            expect(err).toBeInstanceOf(RateLimitExceededException);
            expect(err.message).toBe('Rate limited');
            done();
          },
        });
      });
    });

    it('should pass through non-RateLimitExceededException errors', (done) => {
      const options: RateLimitOptions = {
        type: RateLimitType.LOGIN_BY_EMAIL,
        identifierArg: 'email',
      };

      jest.spyOn(reflector, 'get').mockReturnValue(options);
      jest
        .spyOn(rateLimitService, 'checkLimitByType')
        .mockResolvedValue(mockRateLimitResult);

      const error = new Error('Some other error');
      const mockErrorHandler: CallHandler = {
        handle: jest.fn().mockReturnValue(throwError(() => error)),
      };

      const context = createMockExecutionContext(options, createMockGqlArgs({
        email: 'test@example.com',
        password: 'password123',
      }));

      interceptor.intercept(context, mockErrorHandler).then((obs) => {
        obs.subscribe({
          error: (err: Error) => {
            expect(err).toBeInstanceOf(Error);
            expect(err.message).toBe('Some other error');
            done();
          },
        });
      });
    });
  });

  describe('extractIdentifierFromValue', () => {
    it('should return string value as-is', () => {
      const result = (interceptor as any).extractIdentifierFromValue('test@example.com');
      expect(result).toBe('test@example.com');
    });

    it('should return null for non-string primitives', () => {
      expect((interceptor as any).extractIdentifierFromValue(123)).toBe(null);
      expect((interceptor as any).extractIdentifierFromValue(true)).toBe(null);
      expect((interceptor as any).extractIdentifierFromValue(null)).toBe(null);
      expect((interceptor as any).extractIdentifierFromValue(undefined)).toBe(null);
    });

    it('should extract email from object', () => {
      const result = (interceptor as any).extractIdentifierFromValue({
        email: 'test@example.com',
        password: 'secret',
      });
      expect(result).toBe('test@example.com');
    });

    it('should extract ip from object', () => {
      const result = (interceptor as any).extractIdentifierFromValue({
        ip: '192.168.1.1',
      });
      expect(result).toBe('192.168.1.1');
    });

    it('should extract ipAddress from object', () => {
      const result = (interceptor as any).extractIdentifierFromValue({
        ipAddress: '10.0.0.1',
      });
      expect(result).toBe('10.0.0.1');
    });

    it('should return null for object without identifier properties', () => {
      const result = (interceptor as any).extractIdentifierFromValue({
        username: 'testuser',
        password: 'secret',
      });
      expect(result).toBe(null);
    });
  });
});
