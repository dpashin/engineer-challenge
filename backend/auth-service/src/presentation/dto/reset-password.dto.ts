import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';

export enum ResetPasswordErrorCode {
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_ALREADY_USED = 'TOKEN_ALREADY_USED',
  INVALID_PASSWORD = 'INVALID_PASSWORD',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

registerEnumType(ResetPasswordErrorCode, {
  name: 'ResetPasswordErrorCode',
});

@ObjectType('ResetPasswordError')
export class ResetPasswordErrorType {
  @Field(() => ResetPasswordErrorCode)
  code: ResetPasswordErrorCode;

  @Field({ nullable: true })
  message?: string;
}

@ObjectType('ResetPasswordResult')
export class ResetPasswordResultType {
  @Field()
  success: boolean;

  @Field(() => ResetPasswordErrorType, { nullable: true })
  error?: ResetPasswordErrorType;
}
