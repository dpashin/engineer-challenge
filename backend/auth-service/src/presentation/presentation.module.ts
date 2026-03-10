import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { AuthResolver } from './graphql/auth.resolver';

@Module({
  imports: [CqrsModule],
  providers: [AuthResolver],
  exports: [AuthResolver],
})
export class PresentationModule {}
