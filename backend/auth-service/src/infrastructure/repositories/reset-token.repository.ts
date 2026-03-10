import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class ResetTokenRepository {
  private readonly logger = new Logger(ResetTokenRepository.name);

  constructor(private readonly db: DatabaseService) {}

  async findByToken(tokenHash: string): Promise<{
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    usedAt: Date | null;
    revokedAt: Date | null;
  } | null> {
    const rows = await this.db.query(
      `SELECT id, user_id, token_hash, expires_at, used_at, revoked_at
       FROM password_reset_tokens
       WHERE token_hash = $1
         AND used_at IS NULL
         AND revoked_at IS NULL`,
      [tokenHash],
    );

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      tokenHash: row.token_hash,
      expiresAt: row.expires_at,
      usedAt: row.used_at,
      revokedAt: row.revoked_at,
    };
  }

  async create(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.db.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, tokenHash, expiresAt],
    );
  }

  async markAsUsed(tokenId: string): Promise<void> {
    await this.db.query(
      `UPDATE password_reset_tokens 
       SET used_at = NOW()
       WHERE id = $1`,
      [tokenId],
    );
  }

  async invalidateAllUserTokens(userId: string): Promise<void> {
    await this.db.query(
      `UPDATE password_reset_tokens 
       SET revoked_at = NOW()
       WHERE user_id = $1 
         AND used_at IS NULL 
         AND revoked_at IS NULL
         AND expires_at > NOW()`,
      [userId],
    );
  }

  async cleanupExpiredTokens(): Promise<number> {
    const rows = await this.db.query<{ id: string }>(
      `DELETE FROM password_reset_tokens
       WHERE expires_at < NOW() OR revoked_at IS NOT NULL`,
    );

    return rows.length;
  }
}
