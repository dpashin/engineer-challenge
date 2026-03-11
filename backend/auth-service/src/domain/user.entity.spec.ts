import { User } from './user.entity';

describe('User Entity', () => {
  const validEmail = 'test@example.com';
  const validPasswordHash = 'hashed_password_123';

  describe('create', () => {
    it('should create a new user with correct default values', () => {
      const user = User.create(validEmail, validPasswordHash);
      const props = user.toProps();

      expect(user).toBeInstanceOf(User);
      expect(props.email).toBe(validEmail);
      expect(props.passwordHash).toBe(validPasswordHash);
      expect(props.isActive).toBe(true);
      expect(props.deletedAt).toBeNull();
      expect(props.failedLoginAttempts).toBe(0);
      expect(props.lastFailedLoginAt).toBeNull();
      expect(props.lockedUntil).toBeNull();
      expect(props.resetRequestBlockedUntil).toBeNull();
      expect(props.failedResetAttempts).toBe(0);
      expect(props.lastFailedResetAt).toBeNull();
      expect(props.passwordChangedAt).toBeNull();
      expect(props.id).toBeDefined();
      expect(props.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('toProps', () => {
    it('should return a copy of user properties', () => {
      const user = User.create(validEmail, validPasswordHash);
      const props = user.toProps();

      expect(props).toEqual(user.toProps());
      expect(props).not.toBe(user.toProps()); // Should be a copy
    });
  });

  describe('isActive', () => {
    it('should return true for active user', () => {
      const user = User.create(validEmail, validPasswordHash);
      expect(user.isActive()).toBe(true);
    });

    it('should return false after delete is called', () => {
      const user = User.create(validEmail, validPasswordHash);
      user.delete();
      expect(user.isActive()).toBe(false);
    });
  });

  describe('isLocked', () => {
    it('should return false when user is not locked', () => {
      const user = User.create(validEmail, validPasswordHash);
      expect(user.isLocked()).toBe(false);
    });

    it('should return true when locked until future date', () => {
      const user = User.create(validEmail, validPasswordHash);
      const futureDate = new Date(Date.now() + 3600000); // 1 hour from now
      user.lock(futureDate);
      expect(user.isLocked()).toBe(true);
    });

    it('should return false when lock has expired', () => {
      const user = User.create(validEmail, validPasswordHash);
      const pastDate = new Date(Date.now() - 3600000); // 1 hour ago
      user.lock(pastDate);
      expect(user.isLocked()).toBe(false);
    });
  });

  describe('getRemainingLockoutTime', () => {
    it('should return 0 when user is not locked', () => {
      const user = User.create(validEmail, validPasswordHash);
      expect(user.getRemainingLockoutTime()).toBe(0);
    });

    it('should return remaining time in seconds for active lock', () => {
      const user = User.create(validEmail, validPasswordHash);
      const futureDate = new Date(Date.now() + 5000); // 5 seconds from now
      user.lock(futureDate);
      
      const remainingTime = user.getRemainingLockoutTime();
      expect(remainingTime).toBeGreaterThan(0);
      expect(remainingTime).toBeLessThanOrEqual(5);
    });

    it('should return 0 when lock has expired', () => {
      const user = User.create(validEmail, validPasswordHash);
      const pastDate = new Date(Date.now() - 1000);
      user.lock(pastDate);
      
      expect(user.getRemainingLockoutTime()).toBe(0);
    });
  });

  describe('lock', () => {
    it('should set lockedUntil date', () => {
      const user = User.create(validEmail, validPasswordHash);
      const lockDate = new Date(Date.now() + 3600000);
      
      user.lock(lockDate);
      
      expect(user.getLockedUntil()).toEqual(lockDate);
    });
  });

  describe('unlock', () => {
    it('should clear lock and reset failed login attempts', () => {
      const user = User.create(validEmail, validPasswordHash);
      user.recordFailedLogin();
      user.recordFailedLogin();
      user.lock(new Date(Date.now() + 3600000));
      
      user.unlock();
      
      expect(user.getLockedUntil()).toBeNull();
      expect(user.getFailedLoginAttempts()).toBe(0);
      expect(user.getLastFailedLoginAt()).toBeNull();
    });
  });

  describe('recordFailedLogin', () => {
    it('should increment failed login attempts', () => {
      const user = User.create(validEmail, validPasswordHash);
      
      user.recordFailedLogin();
      expect(user.getFailedLoginAttempts()).toBe(1);
      
      user.recordFailedLogin();
      expect(user.getFailedLoginAttempts()).toBe(2);
    });

    it('should set lastFailedLoginAt to current date', () => {
      const user = User.create(validEmail, validPasswordHash);
      const beforeDate = Date.now();
      
      user.recordFailedLogin();
      
      const afterDate = Date.now();
      const lastFailedAt = user.getLastFailedLoginAt();
      expect(lastFailedAt).toBeInstanceOf(Date);
      expect(lastFailedAt!.getTime()).toBeGreaterThanOrEqual(beforeDate);
      expect(lastFailedAt!.getTime()).toBeLessThanOrEqual(afterDate);
    });
  });

  describe('resetFailedLogins', () => {
    it('should reset failed login attempts to 0', () => {
      const user = User.create(validEmail, validPasswordHash);
      user.recordFailedLogin();
      user.recordFailedLogin();
      
      user.resetFailedLogins();
      
      expect(user.getFailedLoginAttempts()).toBe(0);
      expect(user.getLastFailedLoginAt()).toBeNull();
    });
  });

  describe('isBlockedFromReset', () => {
    it('should return false when not blocked', () => {
      const user = User.create(validEmail, validPasswordHash);
      expect(user.isBlockedFromReset()).toBe(false);
    });

    it('should return true when blocked until future date', () => {
      const user = User.create(validEmail, validPasswordHash);
      const futureDate = new Date(Date.now() + 3600000);
      user.blockResetRequests(futureDate);
      expect(user.isBlockedFromReset()).toBe(true);
    });

    it('should return false when block has expired', () => {
      const user = User.create(validEmail, validPasswordHash);
      const pastDate = new Date(Date.now() - 3600000);
      user.blockResetRequests(pastDate);
      expect(user.isBlockedFromReset()).toBe(false);
    });
  });

  describe('blockResetRequests', () => {
    it('should set resetRequestBlockedUntil date', () => {
      const user = User.create(validEmail, validPasswordHash);
      const blockDate = new Date(Date.now() + 3600000);
      
      user.blockResetRequests(blockDate);
      
      expect(user.getResetRequestBlockedUntil()).toEqual(blockDate);
    });
  });

  describe('unblockResetRequests', () => {
    it('should clear block and reset failed reset attempts', () => {
      const user = User.create(validEmail, validPasswordHash);
      user.recordFailedReset();
      user.recordFailedReset();
      user.blockResetRequests(new Date(Date.now() + 3600000));
      
      user.unblockResetRequests();
      
      expect(user.getResetRequestBlockedUntil()).toBeNull();
      expect(user.getFailedResetAttempts()).toBe(0);
      expect((user as any).props.lastFailedResetAt).toBeNull();
    });
  });

  describe('recordFailedReset', () => {
    it('should increment failed reset attempts', () => {
      const user = User.create(validEmail, validPasswordHash);
      
      user.recordFailedReset();
      expect(user.getFailedResetAttempts()).toBe(1);
      
      user.recordFailedReset();
      expect(user.getFailedResetAttempts()).toBe(2);
    });

    it('should set lastFailedResetAt to current date', () => {
      const user = User.create(validEmail, validPasswordHash);
      const beforeDate = Date.now();
      
      user.recordFailedReset();
      
      const afterDate = Date.now();
      const lastFailedAt = (user as any).props.lastFailedResetAt;
      expect(lastFailedAt).toBeInstanceOf(Date);
      expect(lastFailedAt.getTime()).toBeGreaterThanOrEqual(beforeDate);
      expect(lastFailedAt.getTime()).toBeLessThanOrEqual(afterDate);
    });
  });

  describe('changePassword', () => {
    it('should update password hash and set passwordChangedAt', () => {
      const user = User.create(validEmail, validPasswordHash);
      const newPasswordHash = 'new_hashed_password_456';
      
      user.changePassword(newPasswordHash);
      
      expect(user.getPasswordHash()).toBe(newPasswordHash);
      expect(user.getPasswordChangedAt()).toBeInstanceOf(Date);
    });

    it('should reset failed login attempts', () => {
      const user = User.create(validEmail, validPasswordHash);
      user.recordFailedLogin();
      user.recordFailedLogin();
      
      user.changePassword('new_hash');
      
      expect(user.getFailedLoginAttempts()).toBe(0);
      expect(user.getLastFailedLoginAt()).toBeNull();
    });
  });

  describe('delete', () => {
    it('should set deletedAt and isActive to false', () => {
      const user = User.create(validEmail, validPasswordHash);
      
      user.delete();
      
      expect(user.getDeletedAt()).toBeInstanceOf(Date);
      expect(user.toProps().isActive).toBe(false);
    });
  });

  describe('getters', () => {
    it('should return all user properties via getters', () => {
      const user = User.create(validEmail, validPasswordHash);
      const props = user.toProps();

      expect(user.getId()).toBe(props.id);
      expect(user.getEmail()).toBe(props.email);
      expect(user.getPasswordHash()).toBe(props.passwordHash);
      expect(user.getCreatedAt()).toEqual(props.createdAt);
      expect(user.getDeletedAt()).toBe(props.deletedAt);
      expect(user.getFailedLoginAttempts()).toBe(props.failedLoginAttempts);
      expect(user.getLastFailedLoginAt()).toBe(props.lastFailedLoginAt);
      expect(user.getLockedUntil()).toBe(props.lockedUntil);
      expect(user.getResetRequestBlockedUntil()).toBe(props.resetRequestBlockedUntil);
      expect(user.getFailedResetAttempts()).toBe(props.failedResetAttempts);
      expect(user.getPasswordChangedAt()).toBe(props.passwordChangedAt);
    });
  });
});
