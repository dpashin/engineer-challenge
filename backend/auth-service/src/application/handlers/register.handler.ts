import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { RegisterCommand } from '../commands/register.command';
import { RegisterResult, RegisterError } from '../commands/register.result';
import { PasswordPolicyService, PasswordViolation } from '../../domain/password-policy.service';
import { UserRepository } from '../../infrastructure/repositories/user.repository';
import { PasswordHasher } from '../../infrastructure/services/password-hasher.service';

@CommandHandler(RegisterCommand)
export class RegisterHandler implements ICommandHandler<RegisterCommand, RegisterResult> {
  private readonly logger = new Logger(RegisterHandler.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(command: RegisterCommand): Promise<RegisterResult> {
    const { email, password } = command;

    this.logger.log(`Attempting to register user with email: ${email}`);

    // Validate password policy
    const passwordValidation = PasswordPolicyService.validate(password);
    if (!passwordValidation.isValid) {
      this.logger.warn(`Password validation failed for ${email}: ${passwordValidation.violations.join(', ')}`);
      return {
        success: false,
        error: RegisterError.INVALID_PASSWORD,
      };
    }

    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      this.logger.warn(`User with email ${email} already exists`);
      return {
        success: false,
        error: RegisterError.EMAIL_ALREADY_EXISTS,
      };
    }

    try {
      // Hash password
      const passwordHash = await this.passwordHasher.hash(password);

      // Create user
      const user = await this.userRepository.create(email, passwordHash);

      this.logger.log(`User registered successfully: ${user.id}`);

      return {
        success: true,
        userId: user.id,
        email: user.email,
      };
    } catch (error) {
      this.logger.error(`Failed to register user: ${error.message}`, error.stack);
      return {
        success: false,
        error: RegisterError.INTERNAL_ERROR,
      };
    }
  }
}
