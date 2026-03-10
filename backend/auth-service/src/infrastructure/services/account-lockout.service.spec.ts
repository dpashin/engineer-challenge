import { AccountLockoutService } from './account-lockout.service';

describe('AccountLockoutService', () => {
  let service: AccountLockoutService;
  let mockUserRepository: any;
  let mockLockoutPolicy: any;

  beforeEach(() => {
    mockUserRepository = {
      findByEmail: jest.fn(),
      isAccountLocked: jest.fn(),
      recordFailedLogin: jest.fn(),
      lockAccount: jest.fn(),
      resetFailedLogins: jest.fn(),
      unlockAccount: jest.fn(),
    };

    mockLockoutPolicy = {
      isAccountLocked: jest.fn(),
      getLockoutExpiration: jest.fn(),
      getRemainingLockoutTime: jest.fn(),
      shouldApplyProgressiveDelay: jest.fn(),
      getProgressiveDelay: jest.fn(),
      calculateLockoutTime: jest.fn(),
      getConfig: jest.fn(),
    };

    service = new AccountLockoutService(mockUserRepository, mockLockoutPolicy);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkLockoutStatus', () => {
    it('should return correct status for non-locked account', async () => {
      mockLockoutPolicy.isAccountLocked.mockReturnValue(false);
      mockLockoutPolicy.getLockoutExpiration.mockReturnValue(null);
      mockLockoutPolicy.getRemainingLockoutTime.mockReturnValue(0);
      mockLockoutPolicy.shouldApplyProgressiveDelay.mockReturnValue(false);
      mockLockoutPolicy.getProgressiveDelay.mockReturnValue(0);

      const status = await service.checkLockoutStatus('user-123', 2, null);

      expect(status.isLocked).toBe(false);
      expect(status.failedAttempts).toBe(2);
      expect(status.shouldApplyDelay).toBe(false);
      expect(status.delayMs).toBe(0);
    });

    it('should return correct status for locked account', async () => {
      const lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
      mockLockoutPolicy.isAccountLocked.mockReturnValue(true);
      mockLockoutPolicy.getLockoutExpiration.mockReturnValue(lockedUntil);
      mockLockoutPolicy.getRemainingLockoutTime.mockReturnValue(1800);
      mockLockoutPolicy.shouldApplyProgressiveDelay.mockReturnValue(true);
      mockLockoutPolicy.getProgressiveDelay.mockReturnValue(10000);

      const status = await service.checkLockoutStatus('user-123', 5, lockedUntil);

      expect(status.isLocked).toBe(true);
      expect(status.remainingLockoutSeconds).toBe(1800);
      expect(status.failedAttempts).toBe(5);
    });
  });

  describe('handleFailedLogin', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      failedLoginAttempts: 2,
      lockedUntil: null,
    };

    it('should increment failed attempts and not lock on first failures', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockUserRepository.isAccountLocked.mockResolvedValue({ locked: false });
      mockLockoutPolicy.getConfig.mockReturnValue({ maxFailedAttempts: 5 });
      mockLockoutPolicy.isAccountLocked.mockReturnValue(false);
      mockLockoutPolicy.getLockoutExpiration.mockReturnValue(null);
      mockLockoutPolicy.getRemainingLockoutTime.mockReturnValue(0);
      mockLockoutPolicy.shouldApplyProgressiveDelay.mockReturnValue(false);
      mockLockoutPolicy.getProgressiveDelay.mockReturnValue(0);

      const status = await service.handleFailedLogin('user-123', 'test@example.com');

      expect(mockUserRepository.recordFailedLogin).toHaveBeenCalledWith('user-123');
      expect(mockUserRepository.lockAccount).not.toHaveBeenCalled();
      expect(status.failedAttempts).toBe(3);
    });

    it('should lock account when max attempts reached', async () => {
      const lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
      mockUserRepository.findByEmail.mockResolvedValue({ ...mockUser, failedLoginAttempts: 4 });
      mockUserRepository.isAccountLocked.mockResolvedValue({ locked: false });
      mockLockoutPolicy.getConfig.mockReturnValue({ maxFailedAttempts: 5 });
      mockLockoutPolicy.calculateLockoutTime.mockReturnValue(lockedUntil);
      mockLockoutPolicy.isAccountLocked.mockReturnValue(true);
      mockLockoutPolicy.getLockoutExpiration.mockReturnValue(lockedUntil);
      mockLockoutPolicy.getRemainingLockoutTime.mockReturnValue(1800);
      mockLockoutPolicy.shouldApplyProgressiveDelay.mockReturnValue(true);
      mockLockoutPolicy.getProgressiveDelay.mockReturnValue(10000);

      const status = await service.handleFailedLogin('user-123', 'test@example.com');

      expect(mockUserRepository.recordFailedLogin).toHaveBeenCalledWith('user-123');
      expect(mockUserRepository.lockAccount).toHaveBeenCalledWith('user-123', lockedUntil);
      expect(status.isLocked).toBe(true);
      expect(status.failedAttempts).toBe(5);
    });

    it('should not increment attempts if already locked', async () => {
      const lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
      mockUserRepository.findByEmail.mockResolvedValue({ ...mockUser, lockedUntil });
      mockUserRepository.isAccountLocked.mockResolvedValue({ locked: true });
      mockLockoutPolicy.isAccountLocked.mockReturnValue(true);
      mockLockoutPolicy.getLockoutExpiration.mockReturnValue(lockedUntil);
      mockLockoutPolicy.getRemainingLockoutTime.mockReturnValue(1800);
      mockLockoutPolicy.shouldApplyProgressiveDelay.mockReturnValue(false);
      mockLockoutPolicy.getProgressiveDelay.mockReturnValue(0);

      await service.handleFailedLogin('user-123', 'test@example.com');

      expect(mockUserRepository.recordFailedLogin).not.toHaveBeenCalled();
      expect(mockUserRepository.lockAccount).not.toHaveBeenCalled();
    });

    it('should return empty status when user not found', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);

      const status = await service.handleFailedLogin('user-123', 'nonexistent@example.com');

      expect(status.isLocked).toBe(false);
      expect(status.failedAttempts).toBe(0);
    });
  });

  describe('handleSuccessfulLogin', () => {
    it('should reset failed logins and unlock account', async () => {
      await service.handleSuccessfulLogin('user-123', 'test@example.com');

      expect(mockUserRepository.resetFailedLogins).toHaveBeenCalledWith('user-123');
      expect(mockUserRepository.unlockAccount).toHaveBeenCalledWith('user-123');
    });
  });

  describe('forceUnlock', () => {
    it('should unlock account', async () => {
      await service.forceUnlock('user-123', 'test@example.com');

      expect(mockUserRepository.unlockAccount).toHaveBeenCalledWith('user-123');
    });
  });

  describe('applyProgressiveDelay', () => {
    it('should delay for specified milliseconds', async () => {
      const delayMs = 100;
      const start = Date.now();

      await service.applyProgressiveDelay(delayMs);

      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(delayMs - 10);
      expect(elapsed).toBeLessThanOrEqual(delayMs + 100);
    });

    it('should not delay when delayMs is 0', async () => {
      const start = Date.now();

      await service.applyProgressiveDelay(0);

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(50);
    });
  });
});
