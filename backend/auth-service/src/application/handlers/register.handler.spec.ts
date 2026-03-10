import { RegisterHandler } from './register.handler';
import { RegisterCommand } from '../commands/register.command';
import { RegisterError } from '../commands/register.result';
import { PasswordViolation } from '../../domain/password-policy.service';

describe('RegisterHandler', () => {
  let handler: RegisterHandler;
  let mockUserRepository: any;
  let mockPasswordHasher: any;

  beforeEach(() => {
    mockUserRepository = {
      findByEmail: jest.fn(),
      create: jest.fn(),
    };

    mockPasswordHasher = {
      hash: jest.fn(),
    };

    handler = new RegisterHandler(mockUserRepository, mockPasswordHasher);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should successfully register a user with valid data', async () => {
      const command = new RegisterCommand('test@example.com', 'Test123!');

      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockPasswordHasher.hash.mockResolvedValue('hashed-password');
      mockUserRepository.create.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
      });

      const result = await handler.execute(command);

      expect(result.success).toBe(true);
      expect(result.userId).toBe('user-id');
      expect(result.email).toBe('test@example.com');
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockPasswordHasher.hash).toHaveBeenCalledWith('Test123!');
      expect(mockUserRepository.create).toHaveBeenCalledWith(
        'test@example.com',
        'hashed-password',
      );
    });

    it('should fail when email already exists', async () => {
      const command = new RegisterCommand('test@example.com', 'Test123!');

      mockUserRepository.findByEmail.mockResolvedValue({
        id: 'existing-user-id',
        email: 'test@example.com',
        passwordHash: 'existing-hash',
      });

      const result = await handler.execute(command);

      expect(result.success).toBe(false);
      expect(result.error).toBe(RegisterError.EMAIL_ALREADY_EXISTS);
      expect(mockUserRepository.create).not.toHaveBeenCalled();
      expect(mockPasswordHasher.hash).not.toHaveBeenCalled();
    });

    it('should fail when password is too short', async () => {
      const command = new RegisterCommand('test@example.com', 'short');

      const result = await handler.execute(command);

      expect(result.success).toBe(false);
      expect(result.error).toBe(RegisterError.INVALID_PASSWORD);
      expect(mockUserRepository.findByEmail).not.toHaveBeenCalled();
      expect(mockUserRepository.create).not.toHaveBeenCalled();
      expect(mockPasswordHasher.hash).not.toHaveBeenCalled();
    });

    it('should fail when password has no uppercase', async () => {
      const command = new RegisterCommand('test@example.com', 'test123!');

      const result = await handler.execute(command);

      expect(result.success).toBe(false);
      expect(result.error).toBe(RegisterError.INVALID_PASSWORD);
    });

    it('should fail when password has no lowercase', async () => {
      const command = new RegisterCommand('test@example.com', 'TEST123!');

      const result = await handler.execute(command);

      expect(result.success).toBe(false);
      expect(result.error).toBe(RegisterError.INVALID_PASSWORD);
    });

    it('should fail when password has no digit', async () => {
      const command = new RegisterCommand('test@example.com', 'Testtest!');

      const result = await handler.execute(command);

      expect(result.success).toBe(false);
      expect(result.error).toBe(RegisterError.INVALID_PASSWORD);
    });

    it('should fail when password has no special character', async () => {
      const command = new RegisterCommand('test@example.com', 'Test1234');

      const result = await handler.execute(command);

      expect(result.success).toBe(false);
      expect(result.error).toBe(RegisterError.INVALID_PASSWORD);
    });

    it('should handle internal errors gracefully', async () => {
      const command = new RegisterCommand('test@example.com', 'Test123!');

      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockPasswordHasher.hash.mockResolvedValue('hashed-password');
      mockUserRepository.create.mockRejectedValue(new Error('Database error'));

      const result = await handler.execute(command);

      expect(result.success).toBe(false);
      expect(result.error).toBe(RegisterError.INTERNAL_ERROR);
    });
  });
});
