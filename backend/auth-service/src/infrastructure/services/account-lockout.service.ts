import { Injectable, Logger } from '@nestjs/common';
import { UserRepository } from '../repositories/user.repository';
import { AccountLockoutPolicyService } from '../../domain/account-lockout-policy.service';

export interface LockoutStatus {
  isLocked: boolean;
  lockedUntil: Date | null;
  remainingLockoutSeconds: number;
  failedAttempts: number;
  shouldApplyDelay: boolean;
  delayMs: number;
}

/**
 * Сервис управления блокировками аккаунтов и прогрессивными задержками
 */
@Injectable()
export class AccountLockoutService {
  private readonly logger = new Logger(AccountLockoutService.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly lockoutPolicy: AccountLockoutPolicyService,
  ) {}

  /**
   * Проверка статуса блокировки аккаунта
   */
  async checkLockoutStatus(userId: string, failedAttempts: number, lockedUntil: Date | null): Promise<LockoutStatus> {
    const isLocked = this.lockoutPolicy.isAccountLocked(failedAttempts, lockedUntil);
    const lockoutExpiration = this.lockoutPolicy.getLockoutExpiration(lockedUntil);
    const remainingSeconds = this.lockoutPolicy.getRemainingLockoutTime(lockoutExpiration);
    const shouldApplyDelay = this.lockoutPolicy.shouldApplyProgressiveDelay(failedAttempts);
    const delayMs = this.lockoutPolicy.getProgressiveDelay(failedAttempts);

    return {
      isLocked,
      lockedUntil: lockoutExpiration,
      remainingLockoutSeconds: remainingSeconds,
      failedAttempts,
      shouldApplyDelay,
      delayMs,
    };
  }

  /**
   * Обработка неудачной попытки входа
   * - Увеличивает счетчик попыток
   * - Блокирует аккаунт при превышении лимита
   * - Возвращает статус блокировки
   */
  async handleFailedLogin(userId: string, email: string): Promise<LockoutStatus> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      this.logger.warn(`User not found for failed login: ${email}`);
      return this.createEmptyLockoutStatus();
    }

    // Проверяем, не истекла ли уже блокировка
    const { locked } = await this.userRepository.isAccountLocked(userId);
    
    let failedAttempts = user.failedLoginAttempts;
    let lockedUntil = user.lockedUntil;

    // Если аккаунт уже заблокирован, не увеличиваем счетчик
    if (!locked) {
      failedAttempts += 1;
      await this.userRepository.recordFailedLogin(userId);

      // Проверяем, нужно ли блокировать аккаунт
      if (failedAttempts >= this.lockoutPolicy.getConfig().maxFailedAttempts) {
        const lockoutTime = this.lockoutPolicy.calculateLockoutTime();
        await this.userRepository.lockAccount(userId, lockoutTime);
        lockedUntil = lockoutTime;

        this.logger.warn(
          `Account locked: ${email} after ${failedAttempts} failed attempts. ` +
          `Locked until: ${lockoutTime.toISOString()}`,
        );
      } else {
        this.logger.warn(
          `Failed login attempt ${failedAttempts} for: ${email}`,
        );
      }
    } else {
      this.logger.warn(
        `Account already locked: ${email}. Locked until: ${lockedUntil?.toISOString()}`,
      );
    }

    return this.checkLockoutStatus(userId, failedAttempts, lockedUntil);
  }

  /**
   * Обработка успешного входа
   * - Сбрасывает счетчик неудачных попыток
   * - Разблокирует аккаунт
   */
  async handleSuccessfulLogin(userId: string, email: string): Promise<void> {
    await this.userRepository.resetFailedLogins(userId);
    await this.userRepository.unlockAccount(userId);

    this.logger.log(`Account unlocked and attempts reset: ${email}`);
  }

  /**
   * Принудительная разблокировка аккаунта (для админских операций)
   */
  async forceUnlock(userId: string, email: string): Promise<void> {
    await this.userRepository.unlockAccount(userId);
    this.logger.log(`Account force unlocked: ${email}`);
  }

  /**
   * Применение прогрессивной задержки (блокирующий вызов)
   */
  async applyProgressiveDelay(delayMs: number): Promise<void> {
    if (delayMs > 0) {
      this.logger.debug(`Applying progressive delay: ${delayMs}ms`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  private createEmptyLockoutStatus(): LockoutStatus {
    return {
      isLocked: false,
      lockedUntil: null,
      remainingLockoutSeconds: 0,
      failedAttempts: 0,
      shouldApplyDelay: false,
      delayMs: 0,
    };
  }
}
