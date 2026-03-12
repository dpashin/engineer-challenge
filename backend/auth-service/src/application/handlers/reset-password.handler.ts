import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { ResetPasswordCommand } from '../commands/reset-password.command';
import { ResetPasswordResult, ResetPasswordError } from '../commands/reset-password.result';
import { PasswordPolicyService } from '../../domain/password-policy.service';
import { ResetTokenPolicyService } from '../../domain/reset-token-policy.service';
import { ResetTokenRepository } from '../../infrastructure/repositories/reset-token.repository';
import { UserRepository } from '../../infrastructure/repositories/user.repository';
import { PasswordHasher } from '../../infrastructure/services/password-hasher.service';

@CommandHandler(ResetPasswordCommand)
export class ResetPasswordHandler implements ICommandHandler<ResetPasswordCommand, ResetPasswordResult> {
  private readonly logger = new Logger(ResetPasswordHandler.name);

  constructor(
    private readonly resetTokenRepository: ResetTokenRepository,
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  /**
   * Запись неудачной попытки сброса пароля и проверка на блокировку
   */
  private async recordFailedAttemptAndCheckBlock(
    userId: string,
    reason: string,
  ): Promise<{ blocked: boolean; blockUntil?: Date }> {
    await this.userRepository.recordFailedReset(userId);
    this.logger.warn(`Failed password reset attempt for user ${userId}: ${reason}`);

    const user = await this.userRepository.findWithFailedResetAttemptsById(userId);
    if (!user) {
      return { blocked: false };
    }

    if (ResetTokenPolicyService.isBlockedByAttempts(user.failedResetAttempts)) {
      const blockUntil = ResetTokenPolicyService.getBlockUntilDate();
      await this.userRepository.blockResetRequests(userId, blockUntil);
      this.logger.warn(`User ${userId} blocked from password reset until ${blockUntil.toISOString()}`);
      return { blocked: true, blockUntil };
    }

    return { blocked: false };
  }

  async execute(command: ResetPasswordCommand): Promise<ResetPasswordResult> {
    const { token, newPassword } = command;

    this.logger.log(`Password reset attempt with token`);

    // Validate new password
    const passwordValidation = PasswordPolicyService.validate(newPassword);
    if (!passwordValidation.isValid) {
      this.logger.warn(`New password validation failed: ${passwordValidation.violations.join(', ')}`);
      return {
        success: false,
        error: ResetPasswordError.INVALID_PASSWORD,
      };
    }

    try {
      // Hash the provided token to compare with stored hash
      const crypto = await import('crypto');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      // Find token
      const tokenRecord = await this.resetTokenRepository.findByToken(tokenHash);
      if (!tokenRecord) {
        return {
          success: false,
          error: ResetPasswordError.INVALID_TOKEN,
        };
      }

      // Check if token is expired
      if (new Date() > new Date(tokenRecord.expiresAt)) {
        await this.recordFailedAttemptAndCheckBlock(tokenRecord.userId, 'token expired');
        return {
          success: false,
          error: ResetPasswordError.TOKEN_EXPIRED,
        };
      }

      // Check if token is already used
      if (tokenRecord.usedAt !== null) {
        await this.recordFailedAttemptAndCheckBlock(tokenRecord.userId, 'token already used');
        return {
          success: false,
          error: ResetPasswordError.TOKEN_ALREADY_USED,
        };
      }

      // Check if token is revoked
      if (tokenRecord.revokedAt !== null) {
        await this.recordFailedAttemptAndCheckBlock(tokenRecord.userId, 'token revoked');
        return {
          success: false,
          error: ResetPasswordError.INVALID_TOKEN,
        };
      }

      // Verify user exists
      const user = await this.userRepository.findById(tokenRecord.userId);
      if (!user) {
        this.logger.error(`User not found for token: ${tokenRecord.userId}`);
        return {
          success: false,
          error: ResetPasswordError.INTERNAL_ERROR,
        };
      }

      // Hash new password
      const newPasswordHash = await this.passwordHasher.hash(newPassword);

      // Change password
      await this.userRepository.changePassword(tokenRecord.userId, newPasswordHash);

      // Mark token as used
      await this.resetTokenRepository.markAsUsed(tokenRecord.id);

      // Invalidate all other tokens for this user
      await this.resetTokenRepository.invalidateAllUserTokens(tokenRecord.userId);

      // Unblock user after successful password reset
      await this.userRepository.unblockResetRequests(tokenRecord.userId);

      this.logger.log(`Password reset successful for user: ${user.id}`);

      return {
        success: true,
      };
    } catch (error) {
      this.logger.error(`Password reset failed: ${error.message}`, error.stack);
      return {
        success: false,
        error: ResetPasswordError.INTERNAL_ERROR,
      };
    }
  }
}
