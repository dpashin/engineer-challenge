import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { LoginCommand } from '../commands/login.command';
import { LoginResult, LoginError } from '../commands/login.result';
import { UserRepository } from '../../infrastructure/repositories/user.repository';
import { PasswordHasher } from '../../infrastructure/services/password-hasher.service';
import { TokenService } from '../../infrastructure/services/token.service';
import { RefreshTokenRepository } from '../../infrastructure/repositories/refresh-token.repository';
import { RateLimitService, RateLimitType } from '../../infrastructure/services/rate-limit';
import { AccountLockoutService } from '../../infrastructure/services/account-lockout.service';

@CommandHandler(LoginCommand)
export class LoginHandler implements ICommandHandler<LoginCommand, LoginResult> {
  private readonly logger = new Logger(LoginHandler.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenService: TokenService,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly rateLimitService: RateLimitService,
    private readonly accountLockoutService: AccountLockoutService,
  ) {}

  async execute(command: LoginCommand): Promise<LoginResult> {
    const { email, password, ipAddress, userAgent } = command;

    this.logger.log(`Login attempt for email: ${email}`);

    try {
      // Проверка rate limiting по email (только для неудачных попыток)
      const emailLimitResult = await this.rateLimitService.checkLimitByType(
        RateLimitType.LOGIN_BY_EMAIL,
        email,
      );

      if (!emailLimitResult.allowed) {
        this.logger.warn(
          `Login rate limit exceeded for email: ${email}. Retry after: ${emailLimitResult.retryAfter}s`,
        );
        return {
          success: false,
          error: LoginError.ACCOUNT_LOCKED,
          retryAfter: emailLimitResult.retryAfter,
        };
      }

      // Проверка rate limiting по IP
      if (ipAddress) {
        const ipLimitResult = await this.rateLimitService.checkLimitByType(
          RateLimitType.LOGIN_BY_IP,
          ipAddress,
        );

        if (!ipLimitResult.allowed) {
          this.logger.warn(
            `Login rate limit exceeded for IP: ${ipAddress}. Retry after: ${ipLimitResult.retryAfter}s`,
          );
          return {
            success: false,
            error: LoginError.TOO_MANY_REQUESTS,
            retryAfter: ipLimitResult.retryAfter,
          };
        }
      }

      // Find user
      const user = await this.userRepository.findByEmail(email);
      if (!user) {
        this.logger.warn(`User not found: ${email}`);
        // Применяем прогрессивную задержку даже для несуществующих пользователей
        await this.applyProgressiveDelayForEmail(email);
        return {
          success: false,
          error: LoginError.USER_NOT_FOUND,
        };
      }

      // Проверка блокировки аккаунта
      if (user.lockedUntil) {
        const lockoutStatus = await this.accountLockoutService.checkLockoutStatus(
          user.id,
          user.failedLoginAttempts,
          user.lockedUntil,
        );

        if (lockoutStatus.isLocked) {
          this.logger.warn(
            `Account is locked: ${email}. Locked until: ${lockoutStatus.lockedUntil?.toISOString()}`,
          );
          return {
            success: false,
            error: LoginError.ACCOUNT_LOCKED,
            retryAfter: lockoutStatus.remainingLockoutSeconds,
            lockedUntil: lockoutStatus.lockedUntil?.toISOString(),
          };
        }
      }

      // Check if account is active
      if (!user.isActive) {
        this.logger.warn(`Account is locked: ${email}`);
        return {
          success: false,
          error: LoginError.ACCOUNT_LOCKED,
        };
      }

      // Verify password
      const isPasswordValid = await this.passwordHasher.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        this.logger.warn(`Invalid password for: ${email}`);
        
        // Обработка неудачной попытки входа с блокировкой и прогрессивной задержкой
        const lockoutStatus = await this.accountLockoutService.handleFailedLogin(user.id, email);
        
        // Применяем прогрессивную задержку перед ответом
        if (lockoutStatus.shouldApplyDelay && !lockoutStatus.isLocked) {
          await this.accountLockoutService.applyProgressiveDelay(lockoutStatus.delayMs);
        }

        return {
          success: false,
          error: LoginError.INVALID_PASSWORD,
          retryAfter: lockoutStatus.isLocked ? lockoutStatus.remainingLockoutSeconds : undefined,
          lockedUntil: lockoutStatus.lockedUntil?.toISOString(),
          failedAttempts: lockoutStatus.failedAttempts,
        };
      }

      // Успешный вход - сбрасываем блокировки
      await this.accountLockoutService.handleSuccessfulLogin(user.id, email);

      // Reset failed login attempts on successful login
      await this.userRepository.resetFailedLogins(user.id);

      // Generate tokens
      const accessToken = await this.tokenService.generateAccessToken(user.id, user.email);
      const { token: refreshToken, expiresAt, jti } = await this.tokenService.generateRefreshToken(user.id);
      const refreshTokenHash = await this.tokenService.hashToken(refreshToken);

      // Save refresh token
      await this.refreshTokenRepository.create(
        user.id,
        refreshTokenHash,
        jti,
        expiresAt,
        ipAddress,
        userAgent,
      );

      this.logger.log(`Login successful for: ${email}`);

      // В production токены устанавливаются в httpOnly cookies через response
      // Для обратной совместимости возвращаем токены в ответе (для старых клиентов)
      return {
        success: true,
        accessToken,
        refreshToken,
        expiresIn: 3600, // 1 hour
      };
    } catch (error) {
      this.logger.error(`Login failed: ${error.message}`, error.stack);
      return {
        success: false,
        error: LoginError.INTERNAL_ERROR,
      };
    }
  }

  /**
   * Применение прогрессивной задержки для несуществующих пользователей
   * (защита от enumeration attacks)
   */
  private async applyProgressiveDelayForEmail(email: string): Promise<void> {
    // Для несуществующих пользователей используем фиктивную задержку
    // чтобы злоумышленник не мог определить существование аккаунта по времени ответа
    const fakeDelay = 1000; // 1 секунда
    await new Promise(resolve => setTimeout(resolve, fakeDelay));
  }
}
