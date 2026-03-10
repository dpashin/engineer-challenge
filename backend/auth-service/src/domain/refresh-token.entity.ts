import { v4 as uuidv4 } from 'uuid';

export interface IRefreshTokenProps {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  revokedAt: Date | null;
  createdAt: Date;
  lastUsedAt: Date | null;
}

export class RefreshToken {
  private readonly _id: string;
  private readonly _userId: string;
  private readonly _tokenHash: string;
  private readonly _expiresAt: Date;
  private readonly _ipAddress: string | null;
  private readonly _userAgent: string | null;
  private _revokedAt: Date | null;
  private readonly _createdAt: Date;
  private _lastUsedAt: Date | null;

  constructor(props: IRefreshTokenProps) {
    this._id = props.id;
    this._userId = props.userId;
    this._tokenHash = props.tokenHash;
    this._expiresAt = props.expiresAt;
    this._ipAddress = props.ipAddress;
    this._userAgent = props.userAgent;
    this._revokedAt = props.revokedAt;
    this._createdAt = props.createdAt;
    this._lastUsedAt = props.lastUsedAt;
  }

  static create(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    ipAddress?: string,
    userAgent?: string
  ): RefreshToken {
    return new RefreshToken({
      id: uuidv4(),
      userId,
      tokenHash,
      expiresAt,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      revokedAt: null,
      createdAt: new Date(),
      lastUsedAt: null,
    });
  }

  // Getters
  get id(): string { return this._id; }
  get userId(): string { return this._userId; }
  get tokenHash(): string { return this._tokenHash; }
  get expiresAt(): Date { return this._expiresAt; }
  get ipAddress(): string | null { return this._ipAddress; }
  get userAgent(): string | null { return this._userAgent; }
  get revokedAt(): Date | null { return this._revokedAt; }
  get createdAt(): Date { return this._createdAt; }
  get lastUsedAt(): Date | null { return this._lastUsedAt; }

  // Domain methods
  isExpired(): boolean {
    return new Date() > this._expiresAt;
  }

  isRevoked(): boolean {
    return this._revokedAt !== null;
  }

  isValid(): boolean {
    return !this.isExpired() && !this.isRevoked();
  }

  revoke(): void {
    this._revokedAt = new Date();
  }

  recordUsage(): void {
    this._lastUsedAt = new Date();
  }

  toProps(): IRefreshTokenProps {
    return {
      id: this._id,
      userId: this._userId,
      tokenHash: this._tokenHash,
      expiresAt: this._expiresAt,
      ipAddress: this._ipAddress,
      userAgent: this._userAgent,
      revokedAt: this._revokedAt,
      createdAt: this._createdAt,
      lastUsedAt: this._lastUsedAt,
    };
  }
}
