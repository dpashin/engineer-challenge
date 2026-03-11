import { Resolver, Mutation, Query, Args, Context } from '@nestjs/graphql';
import { CommandBus } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';

import { RegisterCommand } from '../../application/commands/register.command';
import { LoginCommand } from '../../application/commands/login.command';
import { RequestPasswordResetCommand } from '../../application/commands/request-password-reset.command';
import { ResetPasswordCommand } from '../../application/commands/reset-password.command';
import { RefreshTokenCommand } from '../../application/commands/refresh-token.command';
import { RevokeTokensCommand } from '../../application/commands/revoke-tokens.command';
import { GetUserQuery } from '../../application/queries/get-user.query';

import {
  RegisterResultType,
  RegisterErrorType,
  RegisterErrorCode,
} from '../dto/register.dto';
import {
  LoginResultType,
  LoginErrorType,
  LoginErrorCode,
} from '../dto/login.dto';
import {
  RequestPasswordResetResultType,
  RequestPasswordResetErrorType,
  RequestPasswordResetErrorCode,
} from '../dto/request-password-reset.dto';
import {
  ResetPasswordResultType,
  ResetPasswordErrorType,
  ResetPasswordErrorCode,
} from '../dto/reset-password.dto';
import {
  RefreshTokenResultType,
  RefreshTokenErrorType,
  RefreshTokenErrorCode,
} from '../dto/refresh-token.dto';
import { RevokeTokensResultType } from '../dto/revoke-tokens.dto';
import { GetUserResultType } from '../dto/get-user.dto';
import { HealthCheckResultType } from '../dto/health.dto';
import { RateLimit } from './rate-limit.decorator';
import { RateLimitType } from '../../infrastructure/services/rate-limit';
import { HealthService } from '../../infrastructure/services/health.service';

@Resolver()
export class AuthResolver {
  private readonly logger = new Logger(AuthResolver.name);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly healthService: HealthService,
  ) { }

  @Query(() => String)
  health(): string {
    return 'ok';
  }

  @Query(() => HealthCheckResultType)
  async healthCheck() {
    this.logger.log('Health check requested');
    return this.healthService.checkHealth();
  }

  @Mutation(() => RegisterResultType)
  @RateLimit(RateLimitType.REGISTER_BY_EMAIL, 'email')
  @RateLimit(RateLimitType.REGISTER_BY_IP, 'ipAddress', (args: any) => args[2]?.ipAddress)
  async register(
    @Args('email') email: string,
    @Args('password') password: string,
    @Context() context: any,
  ): Promise<RegisterResultType> {
    this.logger.log(`Register mutation called for email: ${email}`);

    const ipAddress = this.getClientIp(context);

    const result = await this.commandBus.execute(new RegisterCommand(email, password, ipAddress));

    if (!result.success) {
      return {
        success: false,
        error: {
          code: result.error as RegisterErrorCode,
          message: this.getRegisterErrorMessage(result.error as RegisterErrorCode),
        },
      };
    }

    return {
      success: true,
      userId: result.userId,
      email: result.email,
    };
  }

  @Mutation(() => LoginResultType)
  @RateLimit(RateLimitType.LOGIN_BY_EMAIL, 'email')
  @RateLimit(RateLimitType.LOGIN_BY_IP, 'ipAddress', (args: any) => args[2]?.ipAddress)
  async login(
    @Args('email') email: string,
    @Args('password') password: string,
    @Context() context: any,
  ): Promise<LoginResultType> {
    this.logger.log(`Login mutation called for email: ${email}`);

    const ipAddress = this.getClientIp(context);
    const userAgent = this.getUserAgent(context);

    const result = await this.commandBus.execute(
      new LoginCommand(email, password, ipAddress, userAgent),
    );

    if (!result.success) {
      return {
        success: false,
        error: {
          code: result.error as LoginErrorCode,
          message: this.getLoginErrorMessage(result.error as LoginErrorCode),
        },
      };
    }

    // Устанавливаем токены в httpOnly cookies (единственный способ передачи токенов)
    const res = context.res;
    if (res && res.setAuthCookies) {
      res.setAuthCookies(result.accessToken, result.refreshToken);
      this.logger.log(`Tokens set in httpOnly cookies for user: ${result.accessToken ? 'user authenticated' : 'anonymous'}`);
    } else {
      this.logger.warn('Response object or setAuthCookies not available - cookies not set');
    }

    // Возвращаем успех без токенов в теле ответа (токены только в cookies для безопасности)
    return {
      success: true,
      expiresIn: result.expiresIn,
    };
  }

  @Mutation(() => RequestPasswordResetResultType)
  @RateLimit(RateLimitType.PASSWORD_RESET_BY_EMAIL, 'email')
  @RateLimit(RateLimitType.PASSWORD_RESET_BY_IP, 'ipAddress', (args: any) => args[1]?.ipAddress)
  async requestPasswordReset(
    @Args('email') email: string,
    @Context() context: any,
  ): Promise<RequestPasswordResetResultType> {
    this.logger.log(`Password reset requested for email: ${email}`);

    const ipAddress = this.getClientIp(context);

    const result = await this.commandBus.execute(
      new RequestPasswordResetCommand(email, ipAddress),
    );

    if (!result.success) {
      return {
        success: false,
        error: {
          code: result.error as RequestPasswordResetErrorCode,
          message: this.getRequestPasswordResetErrorMessage(
            result.error as RequestPasswordResetErrorCode,
          ),
        },
      };
    }

    // In production, the token is sent via email
    // Return success without exposing the token
    return {
      success: true,
    };
  }

  @Mutation(() => ResetPasswordResultType)
  async resetPassword(
    @Args('token') token: string,
    @Args('newPassword') newPassword: string,
  ): Promise<ResetPasswordResultType> {
    this.logger.log(`Password reset mutation called`);

    const result = await this.commandBus.execute(
      new ResetPasswordCommand(token, newPassword),
    );

    if (!result.success) {
      return {
        success: false,
        error: {
          code: result.error as ResetPasswordErrorCode,
          message: this.getResetPasswordErrorMessage(result.error as ResetPasswordErrorCode),
        },
      };
    }

    return {
      success: true,
    };
  }

  @Mutation(() => RefreshTokenResultType)
  @RateLimit(RateLimitType.TOKEN_REFRESH, 'refreshToken')
  async refreshToken(
    @Args('refreshToken', { nullable: true }) refreshToken: string | null,
    @Context() context: any,
  ): Promise<RefreshTokenResultType> {
    this.logger.log(`Refresh token mutation called`);

    const ipAddress = this.getClientIp(context);
    const userAgent = this.getUserAgent(context);

    // Получаем refresh token из cookies, если не передан в аргументах
    let tokenToRefresh = refreshToken;
    if (!tokenToRefresh && context.req?.cookies?.refresh_token) {
      tokenToRefresh = context.req.cookies.refresh_token;
    }

    if (!tokenToRefresh) {
      return {
        success: false,
        error: {
          code: RefreshTokenErrorCode.INVALID_TOKEN,
          message: 'Refresh token not provided',
        },
      };
    }

    const result = await this.commandBus.execute(
      new RefreshTokenCommand(tokenToRefresh, ipAddress, userAgent),
    );

    if (!result.success) {
      return {
        success: false,
        error: {
          code: result.error as RefreshTokenErrorCode,
          message: this.getRefreshTokenErrorMessage(result.error as RefreshTokenErrorCode),
        },
      };
    }

    // Устанавливаем новые токены в httpOnly cookies (единственный способ передачи токенов)
    const res = context.res;
    if (res && res.setAuthCookies) {
      res.setAuthCookies(result.accessToken, result.refreshToken);
      this.logger.log(`New tokens set in httpOnly cookies`);
    } else {
      this.logger.warn('Response object or setAuthCookies not available - cookies not set');
    }

    // Возвращаем успех без токенов в теле ответа (токены только в cookies для безопасности)
    return {
      success: true,
      expiresIn: result.expiresIn,
    };
  }

  @Mutation(() => RevokeTokensResultType)
  async logout(
    @Args('refreshToken', { nullable: true }) refreshToken: string | null,
    @Args('userId', { nullable: true }) userId: string | null,
    @Context() context: any,
  ): Promise<RevokeTokensResultType> {
    this.logger.log(`Logout mutation called`);

    // Получаем refresh token из cookies, если не передан в аргументах
    let tokenToRevoke = refreshToken;
    if (!tokenToRevoke && context.req?.cookies?.refresh_token) {
      tokenToRevoke = context.req.cookies.refresh_token;
    }

    // Получаем userId из токена, если не передан
    let userIdToUse = userId;
    if (!userIdToUse && context.req?.cookies?.refresh_token) {
      // Можем извлечь userId из refresh token
      const tokenService = context.req.app?.get?.('tokenService');
      if (tokenService) {
        const payload = await tokenService.verifyRefreshToken(tokenToRevoke);
        if (payload?.sub) {
          userIdToUse = payload.sub;
        }
      }
    }

    const result = await this.commandBus.execute(
      new RevokeTokensCommand(userIdToUse || '', tokenToRevoke || undefined),
    );

    // Очищаем cookies
    const res = context.res;
    if (res && res.clearAuthCookies) {
      res.clearAuthCookies();
    }

    return {
      success: result.success,
      revokedCount: result.revokedCount,
    };
  }

  @Query(() => GetUserResultType)
  async getUser(
    @Args('userId') userId: string,
  ): Promise<GetUserResultType> {
    this.logger.log(`Get user query called for userId: ${userId}`);

    const result = await this.commandBus.execute(new GetUserQuery(userId));

    if (!result.found) {
      return {
        found: false,
      };
    }

    return {
      found: true,
      user: {
        id: result.user.id,
        email: result.user.email,
        isActive: result.user.isActive,
        createdAt: result.user.createdAt.toISOString(),
      },
    };
  }

  private getRegisterErrorMessage(code: RegisterErrorCode): string {
    switch (code) {
      case RegisterErrorCode.INVALID_PASSWORD:
        return 'Password does not meet security requirements. Must be at least 8 characters with uppercase, lowercase, digit, and special character.';
      case RegisterErrorCode.EMAIL_ALREADY_EXISTS:
        return 'An account with this email already exists.';
      default:
        return 'An unexpected error occurred. Please try again later.';
    }
  }

  private getLoginErrorMessage(code: LoginErrorCode): string {
    switch (code) {
      case LoginErrorCode.USER_NOT_FOUND:
        return 'Invalid email or password.';
      case LoginErrorCode.INVALID_PASSWORD:
        return 'Invalid email or password.';
      case LoginErrorCode.ACCOUNT_LOCKED:
        return 'Account is locked. Please contact support.';
      default:
        return 'An unexpected error occurred. Please try again later.';
    }
  }

  private getRequestPasswordResetErrorMessage(
    code: RequestPasswordResetErrorCode,
  ): string {
    switch (code) {
      case RequestPasswordResetErrorCode.RATE_LIMITED:
        return 'Too many attempts. Please try again later.';
      default:
        return 'An unexpected error occurred. Please try again later.';
    }
  }

  private getResetPasswordErrorMessage(code: ResetPasswordErrorCode): string {
    switch (code) {
      case ResetPasswordErrorCode.INVALID_TOKEN:
        return 'Invalid or revoked reset token.';
      case ResetPasswordErrorCode.TOKEN_EXPIRED:
        return 'Reset token has expired. Please request a new one.';
      case ResetPasswordErrorCode.TOKEN_ALREADY_USED:
        return 'This reset token has already been used.';
      case ResetPasswordErrorCode.INVALID_PASSWORD:
        return 'New password does not meet security requirements.';
      default:
        return 'An unexpected error occurred. Please try again later.';
    }
  }

  private getRefreshTokenErrorMessage(code: RefreshTokenErrorCode): string {
    switch (code) {
      case RefreshTokenErrorCode.INVALID_TOKEN:
        return 'Invalid refresh token.';
      case RefreshTokenErrorCode.TOKEN_EXPIRED:
        return 'Refresh token has expired. Please login again.';
      case RefreshTokenErrorCode.TOKEN_REVOKED:
        return 'Refresh token has been revoked. Please login again.';
      case RefreshTokenErrorCode.USER_NOT_FOUND:
        return 'User not found. Please login again.';
      case RefreshTokenErrorCode.RATE_LIMITED:
        return 'Too many requests. Please try again later.';
      default:
        return 'An unexpected error occurred. Please try again later.';
    }
  }

  private getClientIp(context: any): string | undefined {
    return context.req?.ip || context.req?.headers?.['x-forwarded-for']?.split(',')[0];
  }

  private getUserAgent(context: any): string | undefined {
    return context.req?.headers?.['user-agent'];
  }
}
