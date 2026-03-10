import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CqrsModule } from '@nestjs/cqrs';
import { CleanupCronService } from './services/cleanup-cron.service';
import { CleanupExpiredEntitiesHandler } from '../../application/handlers/cleanup-expired-entities.handler';

@Module({
  imports: [ScheduleModule.forRoot(), CqrsModule],
  providers: [CleanupCronService, CleanupExpiredEntitiesHandler],
})
export class CronModule {}
