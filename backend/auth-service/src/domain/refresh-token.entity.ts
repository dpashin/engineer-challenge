export interface RefreshTokenProps {
  id: string;
  userId: string;
  tokenHash: string;
  jti: string; // Unique token identifier
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Refresh Token Entity
 * 
 * Представляет JWT refresh токен для обновления сессии пользователя.
 * Токены хранятся в базе данных для возможности отзыва и защиты от replay attacks.
 */
export class RefreshToken {
  private props: RefreshTokenProps;

  constructor(props: RefreshTokenProps) {
    this.props = props;
  }

  static create(
    userId: string,
    tokenHash: string,
    jti: string,
    expiresAt: Date,
    ipAddress?: string,
    userAgent?: string,
  ): RefreshToken {
    return new RefreshToken({
      id: crypto.randomUUID(),
      userId,
      tokenHash,
      jti,
      expiresAt,
      revokedAt: null,
      createdAt: new Date(),
      ipAddress,
      userAgent,
    });
  }

  toProps(): RefreshTokenProps {
    return { ...this.props };
  }

  /**
   * Проверка, истек ли токен
   */
  isExpired(): boolean {
    return new Date() > this.props.expiresAt;
  }

  /**
   * Проверка, отозван ли токен
   */
  isRevoked(): boolean {
    return this.props.revokedAt !== null;
  }

  /**
   * Проверка, валиден ли токен
   */
  isValid(): boolean {
    return !this.isExpired() && !this.isRevoked();
  }

  /**
   * Отозвать токен
   */
  revoke(): void {
    this.props.revokedAt = new Date();
  }

  /**
   * Проверка соответствия хеша токена
   */
  matchesToken(tokenHash: string): boolean {
    return this.props.tokenHash === tokenHash;
  }

  // Геттеры
  getId(): string {
    return this.props.id;
  }

  getUserId(): string {
    return this.props.userId;
  }

  getTokenHash(): string {
    return this.props.tokenHash;
  }

  getJti(): string {
    return this.props.jti;
  }

  getExpiresAt(): Date {
    return this.props.expiresAt;
  }

  getRevokedAt(): Date | null {
    return this.props.revokedAt;
  }

  getCreatedAt(): Date {
    return this.props.createdAt;
  }

  getIpAddress(): string | undefined {
    return this.props.ipAddress;
  }

  getUserAgent(): string | undefined {
    return this.props.userAgent;
  }
}
