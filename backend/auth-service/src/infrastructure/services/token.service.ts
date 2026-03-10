import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { sign, verify } from 'jsonwebtoken';

export interface JwtPayload {
  sub: string; // userId
  email: string;
  jti: string; // unique token identifier
  iat?: number;
  exp?: number;
}

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly accessTokenSecret: string;
  private readonly refreshTokenSecret: string;
  private readonly accessTokenExpiresIn: number;
  private readonly refreshTokenExpiresIn: number;

  constructor(private configService: ConfigService) {
    this.accessTokenSecret = this.configService.get<string>('JWT_ACCESS_SECRET', 'default-access-secret');
    this.refreshTokenSecret = this.configService.get<string>('JWT_REFRESH_SECRET', 'default-refresh-secret');
    this.accessTokenExpiresIn = this.configService.get<number>('JWT_ACCESS_EXPIRES_IN', 3600);
    this.refreshTokenExpiresIn = this.configService.get<number>('JWT_REFRESH_EXPIRES_IN', 604800);
  }

  /**
   * Generate a cryptographically secure random token
   */
  generateSecureToken(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Hash a token using SHA-256
   */
  async hashToken(token: string): Promise<string> {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Generate JWT access token
   */
  async generateAccessToken(userId: string, email: string): Promise<string> {
    const payload: JwtPayload = {
      sub: userId,
      email,
      jti: crypto.randomBytes(16).toString('hex'),
    };

    return sign(payload, this.accessTokenSecret, {
      expiresIn: this.accessTokenExpiresIn,
    });
  }

  /**
   * Generate JWT refresh token with metadata
   */
  async generateRefreshToken(userId: string): Promise<{ token: string; expiresAt: Date; jti: string }> {
    const jti = crypto.randomBytes(16).toString('hex');
    const payload: JwtPayload = {
      sub: userId,
      email: '', // Don't include email in refresh token
      jti,
    };

    const token = sign(payload, this.refreshTokenSecret, {
      expiresIn: this.refreshTokenExpiresIn,
    });

    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + this.refreshTokenExpiresIn);

    return { token, expiresAt, jti };
  }

  /**
   * Verify and decode access token
   */
  async verifyAccessToken(token: string): Promise<JwtPayload | null> {
    try {
      return verify(token, this.accessTokenSecret) as JwtPayload;
    } catch (error) {
      this.logger.warn(`Invalid access token: ${error.message}`);
      return null;
    }
  }

  /**
   * Verify and decode refresh token
   */
  async verifyRefreshToken(token: string): Promise<JwtPayload | null> {
    try {
      return verify(token, this.refreshTokenSecret) as JwtPayload;
    } catch (error) {
      this.logger.warn(`Invalid refresh token: ${error.message}`);
      return null;
    }
  }

  /**
   * Get access token expiration time in seconds
   */
  getAccessTokenExpiresIn(): number {
    return this.accessTokenExpiresIn;
  }
}
