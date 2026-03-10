import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { InfrastructureModule } from '../infrastructure/infrastructure.module';

import { RegisterHandler } from './handlers/register.handler';
import { LoginHandler } from './handlers/login.handler';
import { RequestPasswordResetHandler } from './handlers/request-password-reset.handler';
import { ResetPasswordHandler } from './handlers/reset-password.handler';
import { GetUserHandler } from './handlers/get-user.handler';
import { RefreshTokenHandler } from './handlers/refresh-token.handler';
import { RevokeTokensHandler } from './handlers/revoke-tokens.handler';
import { CleanupExpiredEntitiesHandler } from './handlers/cleanup-expired-entities.handler';

const CommandHandlers = [
  RegisterHandler,
  LoginHandler,
  RequestPasswordResetHandler,
  ResetPasswordHandler,
  RefreshTokenHandler,
  RevokeTokensHandler,
  CleanupExpiredEntitiesHandler,
];

const QueryHandlers = [
  GetUserHandler,
];

@Module({
  imports: [CqrsModule, InfrastructureModule],
  providers: [...CommandHandlers, ...QueryHandlers],
  exports: [...CommandHandlers, ...QueryHandlers],
})
export class ApplicationModule {}
