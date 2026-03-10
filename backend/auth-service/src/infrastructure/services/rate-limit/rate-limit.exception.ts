import { HttpException, HttpStatus } from '@nestjs/common';

export class RateLimitExceededException extends HttpException {
  constructor(
    message: string = 'Too many requests',
    retryAfter?: number,
  ) {
    const response: Record<string, string | number> = {
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      message,
      error: 'Too Many Requests',
    };

    if (retryAfter) {
      response.retryAfter = retryAfter;
    }

    super(response, HttpStatus.TOO_MANY_REQUESTS, {
      cause: 'RATE_LIMIT_EXCEEDED',
    });
  }
}
