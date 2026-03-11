import { CookieMiddleware, CookieOptions } from './cookie.middleware';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';

describe('CookieMiddleware', () => {
  let middleware: CookieMiddleware;
  let mockConfigService: ConfigService;
  let mockRequest: Request;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn(),
    } as unknown as ConfigService;

    mockRequest = {
      cookies: {},
    } as unknown as Request;

    mockResponse = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    } as Partial<Response>;

    mockNext = jest.fn();
  });

  describe('in development mode', () => {
    beforeEach(() => {
      jest.spyOn(mockConfigService, 'get').mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'NODE_ENV') return 'development';
        if (key === 'COOKIE_DOMAIN') return defaultValue;
        return defaultValue;
      });

      middleware = new CookieMiddleware(mockConfigService);
    });

    it('should initialize with correct cookie options for development', () => {
      expect(middleware).toBeDefined();
    });

    it('should extend response with cookie methods', () => {
      const extendedRes = mockResponse as Response & {
        setAuthCookies?: (accessToken: string, refreshToken: string) => void;
        clearAuthCookies?: () => void;
        getRefreshTokenFromCookie?: () => string | undefined;
      };

      middleware.use(mockRequest, extendedRes as Response, mockNext);

      expect(extendedRes.setAuthCookies).toBeDefined();
      expect(extendedRes.clearAuthCookies).toBeDefined();
      expect(extendedRes.getRefreshTokenFromCookie).toBeDefined();
    });

    it('should call next() after extending response', () => {
      const extendedRes = mockResponse as Response & {
        setAuthCookies?: (accessToken: string, refreshToken: string) => void;
        clearAuthCookies?: () => void;
        getRefreshTokenFromCookie?: () => string | undefined;
      };

      middleware.use(mockRequest, extendedRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    describe('setAuthCookies', () => {
      it('should set access_token and refresh_token cookies', () => {
        const extendedRes = mockResponse as Response & {
          setAuthCookies: (accessToken: string, refreshToken: string) => void;
        };

        middleware.use(mockRequest, extendedRes as Response, mockNext);

        const accessToken = 'access_token_123';
        const refreshToken = 'refresh_token_456';

        extendedRes.setAuthCookies(accessToken, refreshToken);

        expect(mockResponse.cookie).toHaveBeenCalledWith(
          'access_token',
          accessToken,
          expect.objectContaining({
            httpOnly: true,
            secure: false, // development mode
            sameSite: 'lax',
            path: '/',
            maxAge: 3600 * 1000, // 1 hour
          }),
        );

        expect(mockResponse.cookie).toHaveBeenCalledWith(
          'refresh_token',
          refreshToken,
          expect.objectContaining({
            httpOnly: true,
            secure: false, // development mode
            sameSite: 'lax',
            path: '/',
            maxAge: 604800 * 1000, // 7 days
          }),
        );
      });
    });

    describe('clearAuthCookies', () => {
      it('should clear access_token and refresh_token cookies', () => {
        const extendedRes = mockResponse as Response & {
          clearAuthCookies: () => void;
        };

        middleware.use(mockRequest, extendedRes as Response, mockNext);

        extendedRes.clearAuthCookies();

        expect(mockResponse.clearCookie).toHaveBeenCalledWith('access_token', { path: '/' });
        expect(mockResponse.clearCookie).toHaveBeenCalledWith('refresh_token', { path: '/' });
      });
    });

    describe('getRefreshTokenFromCookie', () => {
      it('should return refresh_token from cookies', () => {
        const refreshToken = 'refresh_token_456';
        mockRequest.cookies = { refresh_token: refreshToken };

        const extendedRes = mockResponse as Response & {
          getRefreshTokenFromCookie: () => string | undefined;
        };

        middleware.use(mockRequest, extendedRes as Response, mockNext);

        const result = extendedRes.getRefreshTokenFromCookie();

        expect(result).toBe(refreshToken);
      });

      it('should return undefined when refresh_token is not present', () => {
        mockRequest.cookies = {};

        const extendedRes = mockResponse as Response & {
          getRefreshTokenFromCookie: () => string | undefined;
        };

        middleware.use(mockRequest, extendedRes as Response, mockNext);

        const result = extendedRes.getRefreshTokenFromCookie();

        expect(result).toBeUndefined();
      });
    });
  });

  describe('in production mode', () => {
    beforeEach(() => {
      jest.spyOn(mockConfigService, 'get').mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'COOKIE_DOMAIN') return 'example.com';
        return defaultValue;
      });

      middleware = new CookieMiddleware(mockConfigService);
    });

    it('should set secure cookies in production', () => {
      const extendedRes = mockResponse as Response & {
        setAuthCookies: (accessToken: string, refreshToken: string) => void;
      };

      middleware.use(mockRequest, extendedRes as Response, mockNext);

      const accessToken = 'access_token_123';
      const refreshToken = 'refresh_token_456';

      extendedRes.setAuthCookies(accessToken, refreshToken);

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'access_token',
        accessToken,
        expect.objectContaining({
          httpOnly: true,
          secure: true, // production mode
          sameSite: 'lax',
          path: '/',
          maxAge: 3600 * 1000,
          domain: 'example.com',
        }),
      );

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refresh_token',
        refreshToken,
        expect.objectContaining({
          httpOnly: true,
          secure: true, // production mode
          sameSite: 'lax',
          path: '/',
          maxAge: 604800 * 1000,
          domain: 'example.com',
        }),
      );
    });
  });

  describe('with custom cookie domain', () => {
    beforeEach(() => {
      jest.spyOn(mockConfigService, 'get').mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'NODE_ENV') return 'development';
        if (key === 'COOKIE_DOMAIN') return 'custom.domain.com';
        return defaultValue;
      });

      middleware = new CookieMiddleware(mockConfigService);
    });

    it('should use custom domain for cookies', () => {
      const extendedRes = mockResponse as Response & {
        setAuthCookies: (accessToken: string, refreshToken: string) => void;
      };

      middleware.use(mockRequest, extendedRes as Response, mockNext);

      extendedRes.setAuthCookies('access', 'refresh');

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'access_token',
        'access',
        expect.objectContaining({
          domain: 'custom.domain.com',
        }),
      );

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'refresh',
        expect.objectContaining({
          domain: 'custom.domain.com',
        }),
      );
    });
  });
});
