import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { RequestPasswordResetCommand } from '../commands/request-password-reset.command';
import { RequestPasswordResetResult, RequestPasswordResetError } from '../commands/request-password-reset.result';
import { ResetTokenPolicyService } from '../../domain/reset-token-policy.service';
import { UserRepository } from '../../infrastructure/repositories/user.repository';
import { ResetTokenRepository } from '../../infrastructure/repositories/reset-token.repository';
import { TokenService } from '../../infrastructure/services/token.service';
import { EmailService } from '../../infrastructure/services/email.service';

@CommandHandler(RequestPasswordResetCommand)
export class RequestPasswordResetHandler implements ICommandHandler<RequestPasswordResetCommand, RequestPasswordResetResult> {
  private readonly logger = new Logger(RequestPasswordResetHandler.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly resetTokenRepository: ResetTokenRepository,
    private readonly tokenService: TokenService,
    private readonly emailService: EmailService,
  ) {}

  async execute(command: RequestPasswordResetCommand): Promise<RequestPasswordResetResult> {
    const { email, ipAddress } = command;

    this.logger.log(`Password reset request for email: ${email}`);

    try {
      // Find user
      const user = await this.userRepository.findByEmail(email);
      if (!user) {
        this.logger.warn(`User not found: ${email}`);
        // Return success to prevent email enumeration
        return {
          success: true,
        };
      }

      // Check if user is blocked
      if (user.resetRequestBlockedUntil) {
        const blockUntil = new Date(user.resetRequestBlockedUntil);
        if (new Date() < blockUntil) {
          this.logger.warn(`User ${email} is blocked from reset requests until ${blockUntil.toISOString()}`);
          return {
            success: false,
            error: RequestPasswordResetError.RATE_LIMITED,
          };
        }
        // Block expired, unblock user
        await this.userRepository.unblockResetRequests(user.id);
      }

      // Invalidate all existing tokens for this user
      await this.resetTokenRepository.invalidateAllUserTokens(user.id);

      // Generate new token
      const rawToken = this.tokenService.generateSecureToken();
      const tokenHash = await this.tokenService.hashToken(rawToken);
      const expiresAt = ResetTokenPolicyService.getTokenExpirationDate();

      // Save token
      await this.resetTokenRepository.create(user.id, tokenHash, expiresAt);

      this.logger.log(`Password reset token created for user: ${user.id}`);

      // Send password reset email
      await this.emailService.sendPasswordResetEmail(user.email, rawToken);

      return {
        success: true,
        token: rawToken,
      };
    } catch (error) {
      this.logger.error(`Password reset request failed: ${error.message}`, error.stack);
      return {
        success: false,
        error: RequestPasswordResetError.INTERNAL_ERROR,
      };
    }
  }
}
