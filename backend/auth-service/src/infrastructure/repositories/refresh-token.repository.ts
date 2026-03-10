import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class RefreshTokenRepository {
  private readonly logger = new Logger(RefreshTokenRepository.name);

  constructor(private readonly db: DatabaseService) {}

  async findByToken(tokenHash: string): Promise<{
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    revokedAt: Date | null;
    lastUsedAt: Date | null;
  } | null> {
    const rows = await this.db.query(
      `SELECT id, user_id, token_hash, expires_at, revoked_at, last_used_at
       FROM refresh_tokens
       WHERE token_hash = $1
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
      revokedAt: row.revoked_at,
      lastUsedAt: row.last_used_at,
    };
  }

  async create(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, tokenHash, expiresAt, ipAddress || null, userAgent || null],
    );
  }

  async revoke(tokenId: string): Promise<void> {
    await this.db.query(
      `UPDATE refresh_tokens
       SET revoked_at = NOW()
       WHERE id = $1`,
      [tokenId],
    );
  }

  async revokeByToken(tokenHash: string): Promise<void> {
    await this.db.query(
      `UPDATE refresh_tokens
       SET revoked_at = NOW()
       WHERE token_hash = $1`,
      [tokenHash],
    );
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.db.query(
      `UPDATE refresh_tokens
       SET revoked_at = NOW()
       WHERE user_id = $1
         AND revoked_at IS NULL`,
      [userId],
    );
  }

  async recordUsage(tokenId: string): Promise<void> {
    await this.db.query(
      `UPDATE refresh_tokens 
       SET last_used_at = NOW()
       WHERE id = $1`,
      [tokenId],
    );
  }

  async cleanupExpiredTokens(): Promise<number> {
    const rows = await this.db.query<{ id: string }>(
      `DELETE FROM refresh_tokens
       WHERE expires_at < NOW()`,
    );

    return rows.length;
  }
}
