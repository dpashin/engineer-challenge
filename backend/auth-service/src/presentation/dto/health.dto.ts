import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';

export enum HealthStatusEnum {
  HEALTHY = 'healthy',
  UNHEALTHY = 'unhealthy',
  DEGRADED = 'degraded',
}

registerEnumType(HealthStatusEnum, {
  name: 'HealthStatusEnum',
});

@ObjectType('DatabaseHealth')
export class DatabaseHealthType {
  @Field(() => HealthStatusEnum)
  status: HealthStatusEnum;

  @Field({ nullable: true })
  message?: string;

  @Field({ nullable: true })
  responseTimeMs?: number;
}

@ObjectType('RedisHealth')
export class RedisHealthType {
  @Field(() => HealthStatusEnum)
  status: HealthStatusEnum;

  @Field({ nullable: true })
  message?: string;

  @Field({ nullable: true })
  responseTimeMs?: number;
}

@ObjectType('HealthCheckResult')
export class HealthCheckResultType {
  @Field(() => HealthStatusEnum)
  status: HealthStatusEnum;

  @Field(() => DatabaseHealthType)
  database: DatabaseHealthType;

  @Field(() => RedisHealthType)
  redis: RedisHealthType;

  @Field()
  uptime: number;

  @Field()
  timestamp: string;
}
