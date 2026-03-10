import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';

export enum RegisterErrorCode {
  INVALID_PASSWORD = 'INVALID_PASSWORD',
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

registerEnumType(RegisterErrorCode, {
  name: 'RegisterErrorCode',
});

@ObjectType('RegisterError')
export class RegisterErrorType {
  @Field(() => RegisterErrorCode)
  code: RegisterErrorCode;

  @Field({ nullable: true })
  message?: string;
}

@ObjectType('RegisterResult')
export class RegisterResultType {
  @Field()
  success: boolean;

  @Field(() => String, { nullable: true })
  userId?: string;

  @Field(() => String, { nullable: true })
  email?: string;

  @Field(() => RegisterErrorType, { nullable: true })
  error?: RegisterErrorType;
}
