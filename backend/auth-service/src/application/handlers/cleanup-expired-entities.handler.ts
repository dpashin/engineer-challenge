import { CommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { CleanupExpiredEntitiesCommand } from '../commands/cleanup-expired-entities.command';
import { ResetTokenRepository } from '../../infrastructure/repositories/reset-token.repository';
import { RefreshTokenRepository } from '../../infrastructure/repositories/refresh-token.repository';
import { DatabaseService } from '../../infrastructure/database/database.service';

export interface CleanupResult {
  passwordResetTokensDeleted: number;
  refreshTokensDeleted: number;
  totalDeleted: number;
}

@CommandHandler(CleanupExpiredEntitiesCommand)
export class CleanupExpiredEntitiesHandler {
  private readonly logger = new Logger(CleanupExpiredEntitiesHandler.name);

  constructor(
    private readonly resetTokenRepository: ResetTokenRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly db: DatabaseService,
  ) {}

  async execute(command: CleanupExpiredEntitiesCommand): Promise<CleanupResult> {
    this.logger.log('Starting cleanup of expired entities');

    // Clean up password_reset_tokens (expired tokens)
    const passwordResetTokensDeleted = await this.cleanupPasswordResetTokens(command.dryRun);

    // Clean up refresh_tokens (expired tokens)
    const refreshTokensDeleted = await this.cleanupRefreshTokens(command.dryRun);

    const totalDeleted = passwordResetTokensDeleted + refreshTokensDeleted;

    this.logger.log(`Cleanup completed. Total deleted: ${totalDeleted}`);

    return {
      passwordResetTokensDeleted,
      refreshTokensDeleted,
      totalDeleted,
    };
  }

  private async cleanupPasswordResetTokens(dryRun: boolean): Promise<number> {
    if (dryRun) {
      const result = await this.db.query<{ count: string }>(
        `SELECT COUNT(*) as count
         FROM password_reset_tokens
         WHERE expires_at < NOW() OR revoked_at IS NOT NULL`,
      );
      const count = parseInt(result[0]?.count ?? '0', 10);
      this.logger.log(`[DRY RUN] Would delete ${count} expired password_reset_tokens`);
      return count;
    }

    const deleted = await this.resetTokenRepository.cleanupExpiredTokens();
    this.logger.log(`Deleted ${deleted} expired password_reset_tokens`);
    return deleted;
  }

  private async cleanupRefreshTokens(dryRun: boolean): Promise<number> {
    if (dryRun) {
      const result = await this.db.query<{ count: string }>(
        `SELECT COUNT(*) as count
         FROM refresh_tokens
         WHERE expires_at < NOW()`,
      );
      const count = parseInt(result[0]?.count ?? '0', 10);
      this.logger.log(`[DRY RUN] Would delete ${count} expired refresh_tokens`);
      return count;
    }

    const deleted = await this.refreshTokenRepository.cleanupExpiredTokens();
    this.logger.log(`Deleted ${deleted} expired refresh_tokens`);
    return deleted;
  }
}
