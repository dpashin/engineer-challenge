import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';

export enum RefreshTokenErrorCode {
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_REVOKED = 'TOKEN_REVOKED',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  RATE_LIMITED = 'RATE_LIMITED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

registerEnumType(RefreshTokenErrorCode, {
  name: 'RefreshTokenErrorCode',
});

@ObjectType('RefreshTokenError')
export class RefreshTokenErrorType {
  @Field(() => RefreshTokenErrorCode)
  code: RefreshTokenErrorCode;

  @Field({ nullable: true })
  message?: string;
}

@ObjectType('RefreshTokenResult')
export class RefreshTokenResultType {
  @Field()
  success: boolean;

  @Field(() => String, { nullable: true })
  accessToken?: string;

  @Field(() => String, { nullable: true })
  refreshToken?: string;

  @Field({ nullable: true })
  expiresIn?: number;

  @Field(() => RefreshTokenErrorType, { nullable: true })
  error?: RefreshTokenErrorType;
}
