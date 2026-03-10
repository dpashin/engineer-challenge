import { v4 as uuidv4 } from 'uuid';

export interface IUserProps {
  id: string;
  email: string;
  passwordHash: string;
  passwordChangedAt: Date;
  isActive: boolean;
  failedLoginAttempts: number;
  lastFailedLoginAt: Date | null;
  resetRequestBlockedUntil: Date | null;
  failedResetAttempts: number;
  lastFailedResetAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export class User {
  private readonly _id: string;
  private _email: string;
  private _passwordHash: string;
  private _passwordChangedAt: Date;
  private _isActive: boolean;
  private _failedLoginAttempts: number;
  private _lastFailedLoginAt: Date | null;
  private _resetRequestBlockedUntil: Date | null;
  private _failedResetAttempts: number;
  private _lastFailedResetAt: Date | null;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _deletedAt: Date | null;

  constructor(props: IUserProps) {
    this._id = props.id;
    this._email = props.email;
    this._passwordHash = props.passwordHash;
    this._passwordChangedAt = props.passwordChangedAt;
    this._isActive = props.isActive;
    this._failedLoginAttempts = props.failedLoginAttempts;
    this._lastFailedLoginAt = props.lastFailedLoginAt;
    this._resetRequestBlockedUntil = props.resetRequestBlockedUntil;
    this._failedResetAttempts = props.failedResetAttempts;
    this._lastFailedResetAt = props.lastFailedResetAt;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
    this._deletedAt = props.deletedAt;
  }

  static create(email: string, passwordHash: string): User {
    const now = new Date();
    return new User({
      id: uuidv4(),
      email,
      passwordHash,
      passwordChangedAt: now,
      isActive: true,
      failedLoginAttempts: 0,
      lastFailedLoginAt: null,
      resetRequestBlockedUntil: null,
      failedResetAttempts: 0,
      lastFailedResetAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }

  // Getters
  get id(): string { return this._id; }
  get email(): string { return this._email; }
  get passwordHash(): string { return this._passwordHash; }
  get passwordChangedAt(): Date { return this._passwordChangedAt; }
  get isActive(): boolean { return this._isActive; }
  get failedLoginAttempts(): number { return this._failedLoginAttempts; }
  get lastFailedLoginAt(): Date | null { return this._lastFailedLoginAt; }
  get resetRequestBlockedUntil(): Date | null { return this._resetRequestBlockedUntil; }
  get failedResetAttempts(): number { return this._failedResetAttempts; }
  get lastFailedResetAt(): Date | null { return this._lastFailedResetAt; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }
  get deletedAt(): Date | null { return this._deletedAt; }

  // Domain methods
  changePassword(newPasswordHash: string): void {
    this._passwordHash = newPasswordHash;
    this._passwordChangedAt = new Date();
    this._failedLoginAttempts = 0;
    this._lastFailedLoginAt = null;
    this._updatedAt = new Date();
  }

  recordFailedLogin(): void {
    this._failedLoginAttempts++;
    this._lastFailedLoginAt = new Date();
    this._updatedAt = new Date();
  }

  resetFailedLogins(): void {
    this._failedLoginAttempts = 0;
    this._lastFailedLoginAt = null;
    this._updatedAt = new Date();
  }

  deactivate(): void {
    this._isActive = false;
    this._updatedAt = new Date();
  }

  activate(): void {
    this._isActive = true;
    this._updatedAt = new Date();
  }

  softDelete(): void {
    this._deletedAt = new Date();
    this._updatedAt = new Date();
  }

  blockResetRequests(until: Date): void {
    this._resetRequestBlockedUntil = until;
    this._updatedAt = new Date();
  }

  unblockResetRequests(): void {
    this._resetRequestBlockedUntil = null;
    this._failedResetAttempts = 0;
    this._lastFailedResetAt = null;
    this._updatedAt = new Date();
  }

  recordFailedResetAttempt(): void {
    this._failedResetAttempts++;
    this._lastFailedResetAt = new Date();
    this._updatedAt = new Date();
  }

  toProps(): IUserProps {
    return {
      id: this._id,
      email: this._email,
      passwordHash: this._passwordHash,
      passwordChangedAt: this._passwordChangedAt,
      isActive: this._isActive,
      failedLoginAttempts: this._failedLoginAttempts,
      lastFailedLoginAt: this._lastFailedLoginAt,
      resetRequestBlockedUntil: this._resetRequestBlockedUntil,
      failedResetAttempts: this._failedResetAttempts,
      lastFailedResetAt: this._lastFailedResetAt,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
      deletedAt: this._deletedAt,
    };
  }
}
