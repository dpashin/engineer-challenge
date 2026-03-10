import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { GetUserQuery } from '../queries/get-user.query';
import { GetUserResult } from '../queries/get-user.result';
import { UserRepository } from '../../infrastructure/repositories/user.repository';

@QueryHandler(GetUserQuery)
export class GetUserHandler implements IQueryHandler<GetUserQuery, GetUserResult> {
  private readonly logger = new Logger(GetUserHandler.name);

  constructor(
    private readonly userRepository: UserRepository,
  ) {}

  async execute(query: GetUserQuery): Promise<GetUserResult> {
    const { userId } = query;

    this.logger.log(`Fetching user: ${userId}`);

    try {
      const user = await this.userRepository.findById(userId);

      if (!user) {
        this.logger.warn(`User not found: ${userId}`);
        return {
          found: false,
        };
      }

      return {
        found: true,
        user: {
          id: user.id,
          email: user.email,
          createdAt: user.createdAt,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to fetch user: ${error.message}`, error.stack);
      return {
        found: false,
      };
    }
  }
}
