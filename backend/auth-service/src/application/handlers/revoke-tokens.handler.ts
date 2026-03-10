import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { RevokeTokensCommand } from '../commands/revoke-tokens.command';
import { RevokeTokensResult } from '../commands/revoke-tokens.result';
import { RefreshTokenRepository } from '../../infrastructure/repositories/refresh-token.repository';

@CommandHandler(RevokeTokensCommand)
export class RevokeTokensHandler implements ICommandHandler<RevokeTokensCommand, RevokeTokensResult> {
  private readonly logger = new Logger(RevokeTokensHandler.name);

  constructor(
    private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  async execute(command: RevokeTokensCommand): Promise<RevokeTokensResult> {
    const { userId, refreshToken } = command;

    try {
      if (refreshToken) {
        // Revoke specific token
        await this.refreshTokenRepository.revokeByToken(refreshToken);
        this.logger.log(`Specific refresh token revoked for user: ${userId}`);
        return {
          success: true,
          revokedCount: 1,
        };
      } else {
        // Revoke all user tokens (logout from all devices)
        await this.refreshTokenRepository.revokeAllUserTokens(userId);
        this.logger.log(`All refresh tokens revoked for user: ${userId}`);
        return {
          success: true,
          revokedCount: 0, // Repository doesn't return count
        };
      }
    } catch (error) {
      this.logger.error(`Failed to revoke tokens: ${error.message}`, error.stack);
      return {
        success: false,
      };
    }
  }
}
