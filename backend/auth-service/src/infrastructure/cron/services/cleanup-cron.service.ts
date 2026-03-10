import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CommandBus } from '@nestjs/cqrs';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import { CleanupExpiredEntitiesCommand } from '../../../application/commands/cleanup-expired-entities.command';

/**
 * Cron service for cleaning up expired entities.
 * Uses PostgreSQL advisory locks to prevent conflicts in multi-instance deployments.
 */
@Injectable()
export class CleanupCronService implements OnModuleInit {
  private readonly logger = new Logger(CleanupCronService.name);
  private readonly lockId: number;
  private readonly lockTimeoutMs: number;

  constructor(
    private readonly commandBus: CommandBus,
    private readonly db: DatabaseService,
    private readonly configService: ConfigService,
  ) {
    // Use a fixed lock ID based on a hash of the task name
    // This ensures all instances use the same lock
    this.lockId = this.configService.get<number>('CLEANUP_CRON_LOCK_ID', 2025030801);
    this.lockTimeoutMs = this.configService.get<number>('CLEANUP_CRON_LOCK_TIMEOUT_MS', 5000);
  }

  async onModuleInit() {
    this.logger.log('CleanupCronService initialized');
  }

  /**
   * Runs daily at 3:00 AM to clean up expired entities.
   * Uses PostgreSQL advisory lock to ensure only one instance executes the cleanup.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleCleanup(): Promise<void> {
    this.logger.log('Attempting to acquire cleanup lock...');

    const lockAcquired = await this.tryAcquireLock();

    if (!lockAcquired) {
      this.logger.log('Could not acquire lock. Another instance is running the cleanup.');
      return;
    }

    try {
      this.logger.log('Lock acquired. Starting cleanup...');
      await this.executeCleanup();
    } finally {
      await this.releaseLock();
      this.logger.log('Lock released.');
    }
  }

  /**
   * Try to acquire an advisory lock using pg_try_advisory_lock.
   * This is non-blocking and returns immediately if the lock is held by another instance.
   */
  private async tryAcquireLock(): Promise<boolean> {
    try {
      const result = await this.db.query<{ pg_try_advisory_lock: boolean }>(
        'SELECT pg_try_advisory_lock($1) as pg_try_advisory_lock',
        [this.lockId],
      );

      return result[0]?.pg_try_advisory_lock ?? false;
    } catch (error) {
      this.logger.error(`Failed to acquire lock: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * Release the advisory lock.
   */
  private async releaseLock(): Promise<void> {
    try {
      await this.db.query(
        'SELECT pg_advisory_unlock($1)',
        [this.lockId],
      );
    } catch (error) {
      this.logger.error(`Failed to release lock: ${error.message}`, error.stack);
    }
  }

  /**
   * Execute the cleanup command.
   */
  private async executeCleanup(): Promise<void> {
    try {
      const result = await this.commandBus.execute<CleanupExpiredEntitiesCommand, {
        passwordResetTokensDeleted: number;
        refreshTokensDeleted: number;
        totalDeleted: number;
      }>(new CleanupExpiredEntitiesCommand(false));

      this.logger.log(
        `Cleanup completed successfully. ` +
        `Password reset tokens: ${result.passwordResetTokensDeleted}, ` +
        `Refresh tokens: ${result.refreshTokensDeleted}, ` +
        `Total: ${result.totalDeleted}`,
      );
    } catch (error) {
      this.logger.error(`Cleanup failed: ${error.message}`, error.stack);
      throw error;
    }
  }
}
