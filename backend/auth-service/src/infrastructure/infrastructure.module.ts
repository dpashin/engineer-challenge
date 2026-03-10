import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { CronModule } from './cron/cron.module';
import { RedisModule } from './redis/redis.module';
import { UserRepository } from './repositories/user.repository';
import { ResetTokenRepository } from './repositories/reset-token.repository';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';
import { PasswordHasher } from './services/password-hasher.service';
import { TokenService } from './services/token.service';
import { EmailService } from './services/email.service';
import { RateLimitService } from './services/rate-limit/rate-limit.service';

@Global()
@Module({
  imports: [ConfigModule, DatabaseModule, CronModule, RedisModule],
  providers: [
    UserRepository,
    ResetTokenRepository,
    RefreshTokenRepository,
    PasswordHasher,
    TokenService,
    EmailService,
    RateLimitService,
  ],
  exports: [
    DatabaseModule,
    UserRepository,
    ResetTokenRepository,
    RefreshTokenRepository,
    PasswordHasher,
    TokenService,
    EmailService,
    RateLimitService,
  ],
})
export class InfrastructureModule {}
