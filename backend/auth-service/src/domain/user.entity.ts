export interface UserProps {
  id: string;
  email: string;
  passwordHash: string;
  isActive: boolean;
  createdAt: Date;
  deletedAt: Date | null;
  failedLoginAttempts: number;
  lastFailedLoginAt: Date | null;
  lockedUntil: Date | null;
  resetRequestBlockedUntil: Date | null;
  failedResetAttempts: number;
  lastFailedResetAt: Date | null;
  passwordChangedAt: Date | null;
}

/**
 * User Aggregate Root
 * 
 * Представляет пользователя в системе аутентификации.
 * Содержит данные о блокировках и попытках входа для защиты от abuse.
 */
export class User {
  private props: UserProps;

  constructor(props: UserProps) {
    this.props = props;
  }

  static create(email: string, passwordHash: string): User {
    return new User({
      id: crypto.randomUUID(),
      email,
      passwordHash,
      isActive: true,
      createdAt: new Date(),
      deletedAt: null,
      failedLoginAttempts: 0,
      lastFailedLoginAt: null,
      lockedUntil: null,
      resetRequestBlockedUntil: null,
      failedResetAttempts: 0,
      lastFailedResetAt: null,
      passwordChangedAt: null,
    });
  }

  toProps(): UserProps {
    return { ...this.props };
  }

  /**
   * Проверка, активен ли аккаунт
   */
  isActive(): boolean {
    return this.props.isActive && !this.props.deletedAt;
  }

  /**
   * Проверка, заблокирован ли аккаунт
   */
  isLocked(): boolean {
    if (!this.props.lockedUntil) {
      return false;
    }
    return new Date() < this.props.lockedUntil;
  }

  /**
   * Получение оставшегося времени блокировки в секундах
   */
  getRemainingLockoutTime(): number {
    if (!this.props.lockedUntil) {
      return 0;
    }

    const now = new Date();
    const remaining = this.props.lockedUntil.getTime() - now.getTime();

    return Math.max(0, Math.ceil(remaining / 1000));
  }

  /**
   * Блокировка аккаунта на указанное время
   */
  lock(lockedUntil: Date): void {
    this.props.lockedUntil = lockedUntil;
  }

  /**
   * Разблокировка аккаунта
   */
  unlock(): void {
    this.props.lockedUntil = null;
    this.props.failedLoginAttempts = 0;
    this.props.lastFailedLoginAt = null;
  }

  /**
   * Запись неудачной попытки входа
   */
  recordFailedLogin(): void {
    this.props.failedLoginAttempts += 1;
    this.props.lastFailedLoginAt = new Date();
  }

  /**
   * Сброс счетчика неудачных попыток входа
   */
  resetFailedLogins(): void {
    this.props.failedLoginAttempts = 0;
    this.props.lastFailedLoginAt = null;
  }

  /**
   * Проверка, заблокирован ли пользователь от запросов сброса пароля
   */
  isBlockedFromReset(): boolean {
    if (!this.props.resetRequestBlockedUntil) {
      return false;
    }
    return new Date() < this.props.resetRequestBlockedUntil;
  }

  /**
   * Блокировка запросов сброса пароля
   */
  blockResetRequests(blockedUntil: Date): void {
    this.props.resetRequestBlockedUntil = blockedUntil;
  }

  /**
   * Разблокировка запросов сброса пароля
   */
  unblockResetRequests(): void {
    this.props.resetRequestBlockedUntil = null;
    this.props.failedResetAttempts = 0;
    this.props.lastFailedResetAt = null;
  }

  /**
   * Запись неудачной попытки сброса пароля
   */
  recordFailedReset(): void {
    this.props.failedResetAttempts += 1;
    this.props.lastFailedResetAt = new Date();
  }

  /**
   * Смена пароля
   */
  changePassword(newPasswordHash: string): void {
    this.props.passwordHash = newPasswordHash;
    this.props.passwordChangedAt = new Date();
    this.resetFailedLogins();
  }

  /**
   * Мягкое удаление пользователя
   */
  delete(): void {
    this.props.deletedAt = new Date();
    this.props.isActive = false;
  }

  // Геттеры
  getId(): string {
    return this.props.id;
  }

  getEmail(): string {
    return this.props.email;
  }

  getPasswordHash(): string {
    return this.props.passwordHash;
  }

  getCreatedAt(): Date {
    return this.props.createdAt;
  }

  getDeletedAt(): Date | null {
    return this.props.deletedAt;
  }

  getFailedLoginAttempts(): number {
    return this.props.failedLoginAttempts;
  }

  getLastFailedLoginAt(): Date | null {
    return this.props.lastFailedLoginAt;
  }

  getLockedUntil(): Date | null {
    return this.props.lockedUntil;
  }

  getResetRequestBlockedUntil(): Date | null {
    return this.props.resetRequestBlockedUntil;
  }

  getFailedResetAttempts(): number {
    return this.props.failedResetAttempts;
  }

  getPasswordChangedAt(): Date | null {
    return this.props.passwordChangedAt;
  }
}
