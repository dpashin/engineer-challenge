import { v4 as uuidv4 } from 'uuid';

export interface IPasswordResetTokenProps {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

export class PasswordResetToken {
  private readonly _id: string;
  private readonly _userId: string;
  private readonly _tokenHash: string;
  private readonly _expiresAt: Date;
  private _usedAt: Date | null;
  private _revokedAt: Date | null;
  private readonly _createdAt: Date;

  constructor(props: IPasswordResetTokenProps) {
    this._id = props.id;
    this._userId = props.userId;
    this._tokenHash = props.tokenHash;
    this._expiresAt = props.expiresAt;
    this._usedAt = props.usedAt;
    this._revokedAt = props.revokedAt;
    this._createdAt = props.createdAt;
  }

  static create(userId: string, tokenHash: string, expiresAt: Date): PasswordResetToken {
    return new PasswordResetToken({
      id: uuidv4(),
      userId,
      tokenHash,
      expiresAt,
      usedAt: null,
      revokedAt: null,
      createdAt: new Date(),
    });
  }

  // Getters
  get id(): string { return this._id; }
  get userId(): string { return this._userId; }
  get tokenHash(): string { return this._tokenHash; }
  get expiresAt(): Date { return this._expiresAt; }
  get usedAt(): Date | null { return this._usedAt; }
  get revokedAt(): Date | null { return this._revokedAt; }
  get createdAt(): Date { return this._createdAt; }

  // Domain methods
  isExpired(): boolean {
    return new Date() > this._expiresAt;
  }

  isUsed(): boolean {
    return this._usedAt !== null;
  }

  isRevoked(): boolean {
    return this._revokedAt !== null;
  }

  isValid(): boolean {
    return !this.isExpired() && !this.isUsed() && !this.isRevoked();
  }

  markAsUsed(): void {
    this._usedAt = new Date();
  }

  revoke(): void {
    this._revokedAt = new Date();
  }

  toProps(): IPasswordResetTokenProps {
    return {
      id: this._id,
      userId: this._userId,
      tokenHash: this._tokenHash,
      expiresAt: this._expiresAt,
      usedAt: this._usedAt,
      revokedAt: this._revokedAt,
      createdAt: this._createdAt,
    };
  }
}
