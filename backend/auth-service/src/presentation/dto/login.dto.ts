import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';

export enum LoginErrorCode {
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  INVALID_PASSWORD = 'INVALID_PASSWORD',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
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

  @Field(() => String, { nullable: true })
  accessToken?: string;

  @Field(() => String, { nullable: true })
  refreshToken?: string;

  @Field(() => Number, { nullable: true })
  expiresIn?: number;

  @Field(() => LoginErrorType, { nullable: true })
  error?: LoginErrorType;
}
