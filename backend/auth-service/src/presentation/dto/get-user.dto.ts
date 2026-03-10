import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType('User')
export class UserType {
  @Field()
  id: string;

  @Field()
  email: string;

  @Field()
  isActive: boolean;

  @Field()
  createdAt: string;
}

@ObjectType('GetUserResult')
export class GetUserResultType {
  @Field()
  found: boolean;

  @Field(() => UserType, { nullable: true })
  user?: UserType;
}
