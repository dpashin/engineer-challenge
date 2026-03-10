import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';

export interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  path: string;
  maxAge: number;
  domain?: string;
}

@Injectable()
export class CookieMiddleware implements NestMiddleware {
  private readonly cookieOptions: {
    access: CookieOptions;
    refresh: CookieOptions;
  };

  constructor(private configService: ConfigService) {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    const cookieDomain = this.configService.get<string>('COOKIE_DOMAIN');

    this.cookieOptions = {
      access: {
        httpOnly: true,
        secure: isProduction, // true только в production (HTTPS)
        sameSite: 'lax',
        path: '/',
        maxAge: 3600 * 1000, // 1 hour in milliseconds
        domain: cookieDomain,
      },
      refresh: {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
        maxAge: 604800 * 1000, // 7 days in milliseconds
        domain: cookieDomain,
      },
    };
  }

  use(req: Request, res: Response, next: NextFunction) {
    // Extend response with cookie methods
    const extendedRes = res as Response & {
      setAuthCookies?: (accessToken: string, refreshToken: string) => void;
      clearAuthCookies?: () => void;
      getRefreshTokenFromCookie?: () => string | undefined;
    };

    extendedRes.setAuthCookies = (accessToken: string, refreshToken: string) => {
      res.cookie('access_token', accessToken, this.cookieOptions.access);
      res.cookie('refresh_token', refreshToken, this.cookieOptions.refresh);
    };

    extendedRes.clearAuthCookies = () => {
      res.clearCookie('access_token', { path: '/' });
      res.clearCookie('refresh_token', { path: '/' });
    };

    extendedRes.getRefreshTokenFromCookie = () => {
      return req.cookies?.refresh_token;
    };

    next();
  }
}
