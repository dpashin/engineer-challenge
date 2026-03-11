import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';

export enum LoginErrorCode {
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  INVALID_PASSWORD = 'INVALID_PASSWORD',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

registerEnumType(LoginErrorCode, {
  name: 'LoginErrorCode',
});

@ObjectType('LoginError')
export class LoginErrorType {
  @Field(() => LoginErrorCode)
  code: LoginErrorCode;

  @Field({ nullable: true })
  message?: string;
}

@ObjectType('LoginResult')
export class LoginResultType {
  @Field()
  success: boolean;

  // Токены передаются только через httpOnly cookies для безопасности
  @Field(() => Number, { nullable: true })
  expiresIn?: number;

  @Field(() => LoginErrorType, { nullable: true })
  error?: LoginErrorType;

  @Field(() => Number, { nullable: true })
  retryAfter?: number;

  @Field(() => String, { nullable: true })
  lockedUntil?: string;

  @Field(() => Number, { nullable: true })
  failedAttempts?: number;
}
