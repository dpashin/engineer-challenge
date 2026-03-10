import { Module, Global, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { CronModule } from './cron/cron.module';
import { RedisModule } from './redis/redis.module';
import { RateLimitModule } from './services/rate-limit/rate-limit.module';
import { UserRepository } from './repositories/user.repository';
import { ResetTokenRepository } from './repositories/reset-token.repository';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';
import { PasswordHasher } from './services/password-hasher.service';
import { TokenService } from './services/token.service';
import { EmailService } from './services/email.service';
import { CookieMiddleware } from './middleware/cookie.middleware';

@Global()
@Module({
  imports: [ConfigModule, DatabaseModule, CronModule, RedisModule, RateLimitModule],
  providers: [
    UserRepository,
    ResetTokenRepository,
    RefreshTokenRepository,
    PasswordHasher,
    TokenService,
    EmailService,
    CookieMiddleware,
  ],
  exports: [
    DatabaseModule,
    UserRepository,
    ResetTokenRepository,
    RefreshTokenRepository,
    PasswordHasher,
    TokenService,
    EmailService,
    RateLimitModule,
  ],
})
export class InfrastructureModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CookieMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
