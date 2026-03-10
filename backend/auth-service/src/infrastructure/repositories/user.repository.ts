import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class UserRepository {
  private readonly logger = new Logger(UserRepository.name);

  constructor(private readonly db: DatabaseService) {}

  async findByEmail(email: string): Promise<{
    id: string;
    email: string;
    passwordHash: string;
    isActive: boolean;
    failedLoginAttempts: number;
    resetRequestBlockedUntil: Date | null;
    failedResetAttempts: number;
  } | null> {
    const rows = await this.db.query(
      `SELECT id, email, password_hash, is_active,
              failed_login_attempts, reset_request_blocked_until,
              failed_reset_attempts
       FROM users
       WHERE email = $1 AND deleted_at IS NULL`,
      [email],
    );

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      isActive: row.is_active,
      failedLoginAttempts: row.failed_login_attempts,
      resetRequestBlockedUntil: row.reset_request_blocked_until,
      failedResetAttempts: row.failed_reset_attempts,
    };
  }

  async findById(userId: string): Promise<{
    id: string;
    email: string;
    isActive: boolean;
    createdAt: Date;
  } | null> {
    const rows = await this.db.query(
      `SELECT id, email, is_active, created_at
       FROM users
       WHERE id = $1 AND deleted_at IS NULL`,
      [userId],
    );

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      id: row.id,
      email: row.email,
      isActive: row.is_active,
      createdAt: row.created_at,
    };
  }

  async create(email: string, passwordHash: string): Promise<{ id: string; email: string }> {
    const rows = await this.db.query(
      `INSERT INTO users (email, password_hash)
       VALUES ($1, $2)
       RETURNING id, email`,
      [email, passwordHash],
    );

    const row = rows[0];
    return {
      id: row.id,
      email: row.email,
    };
  }

  async recordFailedLogin(userId: string): Promise<void> {
    await this.db.query(
      `UPDATE users 
       SET failed_login_attempts = failed_login_attempts + 1,
           last_failed_login_at = NOW()
       WHERE id = $1`,
      [userId],
    );
  }

  async resetFailedLogins(userId: string): Promise<void> {
    await this.db.query(
      `UPDATE users 
       SET failed_login_attempts = 0,
           last_failed_login_at = NULL
       WHERE id = $1`,
      [userId],
    );
  }

  async changePassword(userId: string, newPasswordHash: string): Promise<void> {
    await this.db.query(
      `UPDATE users 
       SET password_hash = $1,
           password_changed_at = NOW(),
           failed_login_attempts = 0,
           last_failed_login_at = NULL
       WHERE id = $2`,
      [newPasswordHash, userId],
    );
  }

  async blockResetRequests(userId: string, until: Date): Promise<void> {
    await this.db.query(
      `UPDATE users 
       SET reset_request_blocked_until = $1,
           failed_reset_attempts = 0
       WHERE id = $2`,
      [until, userId],
    );
  }

  async unblockResetRequests(userId: string): Promise<void> {
    await this.db.query(
      `UPDATE users 
       SET reset_request_blocked_until = NULL,
           failed_reset_attempts = 0,
           last_failed_reset_at = NULL
       WHERE id = $1`,
      [userId],
    );
  }

  async recordFailedResetAttempt(userId: string): Promise<void> {
    await this.db.query(
      `UPDATE users 
       SET failed_reset_attempts = failed_reset_attempts + 1,
           last_failed_reset_at = NOW()
       WHERE id = $1`,
      [userId],
    );
  }
}
