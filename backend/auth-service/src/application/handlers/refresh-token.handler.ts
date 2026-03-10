import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { RefreshTokenCommand } from '../commands/refresh-token.command';
import { RefreshTokenResult, RefreshTokenError } from '../commands/refresh-token.result';
import { RefreshTokenRepository } from '../../infrastructure/repositories/refresh-token.repository';
import { UserRepository } from '../../infrastructure/repositories/user.repository';
import { TokenService } from '../../infrastructure/services/token.service';
import { PasswordHasher } from '../../infrastructure/services/password-hasher.service';

@CommandHandler(RefreshTokenCommand)
export class RefreshTokenHandler implements ICommandHandler<RefreshTokenCommand, RefreshTokenResult> {
  private readonly logger = new Logger(RefreshTokenHandler.name);

  constructor(
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly userRepository: UserRepository,
    private readonly tokenService: TokenService,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(command: RefreshTokenCommand): Promise<RefreshTokenResult> {
    const { refreshToken, ipAddress, userAgent } = command;

    this.logger.log(`Attempting to refresh token`);

    try {
      // Verify the refresh token
      const payload = await this.tokenService.verifyRefreshToken(refreshToken);
      
      if (!payload) {
        this.logger.warn(`Invalid refresh token provided`);
        return {
          success: false,
          error: RefreshTokenError.INVALID_TOKEN,
        };
      }

      const userId = payload.sub;

      // Hash the token to find it in the database
      const tokenHash = await this.tokenService.hashToken(refreshToken);

      // Find the refresh token in the database
      const storedToken = await this.refreshTokenRepository.findByToken(tokenHash);
      
      if (!storedToken) {
        this.logger.warn(`Refresh token not found in database`);
        return {
          success: false,
          error: RefreshTokenError.INVALID_TOKEN,
        };
      }

      // Check if token is expired
      if (new Date() > storedToken.expiresAt) {
        this.logger.warn(`Refresh token expired for user: ${userId}`);
        await this.refreshTokenRepository.revoke(storedToken.id);
        return {
          success: false,
          error: RefreshTokenError.TOKEN_EXPIRED,
        };
      }

      // Check if token is revoked
      if (storedToken.revokedAt !== null) {
        this.logger.warn(`Refresh token revoked for user: ${userId}`);
        return {
          success: false,
          error: RefreshTokenError.TOKEN_REVOKED,
        };
      }

      // Check if user exists and is active
      const user = await this.userRepository.findById(userId);
      if (!user || !user.isActive) {
        this.logger.warn(`User not found or inactive: ${userId}`);
        return {
          success: false,
          error: RefreshTokenError.USER_NOT_FOUND,
        };
      }

      // Generate new tokens
      const newAccessToken = await this.tokenService.generateAccessToken(user.id, user.email);
      const newRefreshTokenData = await this.tokenService.generateRefreshToken(user.id);
      const newRefreshTokenHash = await this.tokenService.hashToken(newRefreshTokenData.token);

      // Revoke old refresh token
      await this.refreshTokenRepository.revoke(storedToken.id);

      // Store new refresh token
      await this.refreshTokenRepository.create(
        user.id,
        newRefreshTokenHash,
        newRefreshTokenData.expiresAt,
        ipAddress,
        userAgent,
      );

      // Update last used time
      await this.refreshTokenRepository.recordUsage(storedToken.id);

      this.logger.log(`Token refreshed successfully for user: ${userId}`);

      return {
        success: true,
        accessToken: newAccessToken,
        refreshToken: newRefreshTokenData.token,
        expiresIn: this.tokenService.getAccessTokenExpiresIn(),
      };
    } catch (error) {
      this.logger.error(`Failed to refresh token: ${error.message}`, error.stack);
      return {
        success: false,
        error: RefreshTokenError.INTERNAL_ERROR,
      };
    }
  }
}
