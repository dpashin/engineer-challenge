import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType('RevokeTokensResult')
export class RevokeTokensResultType {
  @Field()
  success: boolean;

  @Field({ nullable: true })
  revokedCount?: number;
}
