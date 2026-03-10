import { Injectable } from '@nestjs/common';

export interface AccountLockoutConfig {
  maxFailedAttempts: number;
  lockoutDurationMs: number;
  progressiveDelaysEnabled: boolean;
  delayThresholds: ProgressiveDelayThreshold[];
}

export interface ProgressiveDelayThreshold {
  attemptCount: number;
  delayMs: number;
}

/**
 * Политика блокировки аккаунта и прогрессивных задержек
 *
 * Конфигурация:
 * - После 5 неудачных попыток - блокировка на 30 минут
 * - После 3 попыток - задержка 2 секунды
 * - После 4 попыток - задержка 5 секунд
 */
@Injectable()
export class AccountLockoutPolicyService {
  private readonly config: AccountLockoutConfig = {
    maxFailedAttempts: parseInt(process.env.ACCOUNT_LOCKOUT_MAX_ATTEMPTS || '5', 10),
    lockoutDurationMs: parseInt(process.env.ACCOUNT_LOCKOUT_DURATION_MS || (30 * 60 * 1000).toString(), 10),
    progressiveDelaysEnabled: process.env.PROGRESSIVE_DELAYS_ENABLED !== 'false',
    delayThresholds: [
      { attemptCount: 3, delayMs: 2000 },
      { attemptCount: 4, delayMs: 5000 },
      { attemptCount: 5, delayMs: 10000 },
    ],
  };

  /**
   * Проверка, заблокирован ли аккаунт
   */
  isAccountLocked(
    failedAttempts: number,
    lockedUntil: Date | null,
  ): boolean {
    if (lockedUntil !== null) {
      if (new Date() < lockedUntil) {
        return true;
      }
    }

    return failedAttempts >= this.config.maxFailedAttempts;
  }

  /**
   * Получение времени разблокировки (если заблокирован)
   */
  getLockoutExpiration(lockedUntil: Date | null): Date | null {
    if (lockedUntil === null) {
      return null;
    }

    const now = new Date();
    if (now >= lockedUntil) {
      return null; // Уже истекло
    }

    return lockedUntil;
  }

  /**
   * Расчет времени блокировки при достижении лимита попыток
   */
  calculateLockoutTime(): Date {
    return new Date(Date.now() + this.config.lockoutDurationMs);
  }

  /**
   * Получение задержки для текущего количества попыток
   * Возвращает задержку в миллисекундах
   */
  getProgressiveDelay(failedAttempts: number): number {
    if (!this.config.progressiveDelaysEnabled) {
      return 0;
    }

    // Находим максимальную задержку для текущего количества попыток
    let delay = 0;
    for (const threshold of this.config.delayThresholds) {
      if (failedAttempts >= threshold.attemptCount) {
        delay = Math.max(delay, threshold.delayMs);
      }
    }

    return delay;
  }

  /**
   * Проверка, нужно ли применять прогрессивную задержку
   */
  shouldApplyProgressiveDelay(failedAttempts: number): boolean {
    return this.config.progressiveDelaysEnabled && failedAttempts >= 3;
  }

  /**
   * Получение конфигурации
   */
  getConfig(): AccountLockoutConfig {
    return this.config;
  }

  /**
   * Получение оставшегося времени блокировки в секундах
   */
  getRemainingLockoutTime(lockedUntil: Date | null): number {
    if (!lockedUntil) {
      return 0;
    }

    const now = new Date();
    const remaining = lockedUntil.getTime() - now.getTime();

    return Math.max(0, Math.ceil(remaining / 1000));
  }
}
