/**
 * Reset Token Policy Domain Service
 * 
 * Enforces reset token requirements:
 * - Expiration: 10 minutes
 * - Single-use: Token is invalidated after use
 * - Rate limiting: 3 attempts per 30 minutes
 * - Cryptographic security: Minimum 128 bits entropy
 */
export class ResetTokenPolicyService {
  /** Token expiration time in minutes */
  private static readonly TOKEN_EXPIRATION_MINUTES = 10;

  /** Maximum failed reset attempts before blocking */
  private static readonly MAX_FAILED_ATTEMPTS = 3;

  /** Block duration in minutes after max failed attempts */
  private static readonly BLOCK_DURATION_MINUTES = 30;

  /**
   * Calculates token expiration time
   * @returns Date when token expires
   */
  static getTokenExpirationDate(): Date {
    const now = new Date();
    return new Date(now.getTime() + this.TOKEN_EXPIRATION_MINUTES * 60 * 1000);
  }

  /**
   * Checks if token is expired
   * @param expiresAt - Token expiration date
   * @returns true if token is expired
   */
  static isExpired(expiresAt: Date): boolean {
    return new Date() > expiresAt;
  }

  /**
   * Checks if user is blocked from requesting password reset
   * @param failedAttempts - Number of failed attempts
   * @returns true if user is blocked
   */
  static isBlockedByAttempts(failedAttempts: number): boolean {
    return failedAttempts >= this.MAX_FAILED_ATTEMPTS;
  }

  /**
   * Calculates block duration until date
   * @returns Date when block expires
   */
  static getBlockUntilDate(): Date {
    const now = new Date();
    return new Date(now.getTime() + this.BLOCK_DURATION_MINUTES * 60 * 1000);
  }

  /**
   * Gets maximum failed attempts allowed
   * @returns Max failed attempts
   */
  static getMaxFailedAttempts(): number {
    return this.MAX_FAILED_ATTEMPTS;
  }

  /**
   * Gets block duration in minutes
   * @returns Block duration in minutes
   */
  static getBlockDurationMinutes(): number {
    return this.BLOCK_DURATION_MINUTES;
  }

  /**
   * Gets token expiration in minutes
   * @returns Token expiration in minutes
   */
  static getTokenExpirationMinutes(): number {
    return this.TOKEN_EXPIRATION_MINUTES;
  }
}
