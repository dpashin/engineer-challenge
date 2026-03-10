export interface PasswordResetTokenProps {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

export class PasswordResetToken {
  private props: PasswordResetTokenProps;

  constructor(props: PasswordResetTokenProps) {
    this.props = props;
  }

  static create(userId: string, tokenHash: string, expiresAt: Date): PasswordResetToken {
    return new PasswordResetToken({
      id: crypto.randomUUID(),
      userId,
      tokenHash,
      expiresAt,
      usedAt: null,
      revokedAt: null,
      createdAt: new Date(),
    });
  }

  toProps(): PasswordResetTokenProps {
    return { ...this.props };
  }

  isExpired(): boolean {
    return new Date() > this.props.expiresAt;
  }

  isUsed(): boolean {
    return this.props.usedAt !== null;
  }

  isRevoked(): boolean {
    return this.props.revokedAt !== null;
  }

  isValid(): boolean {
    return !this.isExpired() && !this.isUsed() && !this.isRevoked();
  }

  markAsUsed(): void {
    this.props.usedAt = new Date();
  }

  revoke(): void {
    this.props.revokedAt = new Date();
  }

  getId(): string {
    return this.props.id;
  }

  getUserId(): string {
    return this.props.userId;
  }

  getTokenHash(): string {
    return this.props.tokenHash;
  }

  getExpiresAt(): Date {
    return this.props.expiresAt;
  }

  getUsedAt(): Date | null {
    return this.props.usedAt;
  }

  getRevokedAt(): Date | null {
    return this.props.revokedAt;
  }

  getCreatedAt(): Date {
    return this.props.createdAt;
  }
}
