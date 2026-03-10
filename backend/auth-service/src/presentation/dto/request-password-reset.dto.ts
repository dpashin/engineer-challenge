import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';

export enum RequestPasswordResetErrorCode {
  RATE_LIMITED = 'RATE_LIMITED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

registerEnumType(RequestPasswordResetErrorCode, {
  name: 'RequestPasswordResetErrorCode',
});

@ObjectType('RequestPasswordResetError')
export class RequestPasswordResetErrorType {
  @Field(() => RequestPasswordResetErrorCode)
  code: RequestPasswordResetErrorCode;

  @Field({ nullable: true })
  message?: string;
}

@ObjectType('RequestPasswordResetResult')
export class RequestPasswordResetResultType {
  @Field()
  success: boolean;

  @Field(() => String, { nullable: true })
  token?: string;

  @Field(() => RequestPasswordResetErrorType, { nullable: true })
  error?: RequestPasswordResetErrorType;
}
