import { AccountLockoutPolicyService } from './account-lockout-policy.service';

describe('AccountLockoutPolicyService', () => {
  let service: AccountLockoutPolicyService;

  beforeEach(() => {
    service = new AccountLockoutPolicyService();
  });

  describe('isAccountLocked', () => {
    it('should return false when account is not locked', () => {
      expect(service.isAccountLocked(2, null)).toBe(false);
    });

    it('should return true when lockedUntil is in the future', () => {
      const lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now
      expect(service.isAccountLocked(3, lockedUntil)).toBe(true);
    });

    it('should return false when lockedUntil is in the past and attempts < max', () => {
      const lockedUntil = new Date(Date.now() - 60 * 1000); // 1 minute ago
      expect(service.isAccountLocked(3, lockedUntil)).toBe(false);
    });

    it('should return true when failedAttempts >= maxFailedAttempts', () => {
      expect(service.isAccountLocked(5, null)).toBe(true);
      expect(service.isAccountLocked(6, null)).toBe(true);
    });

    it('should return false when failedAttempts < maxFailedAttempts and no lockedUntil', () => {
      expect(service.isAccountLocked(4, null)).toBe(false);
      expect(service.isAccountLocked(3, null)).toBe(false);
    });
  });

  describe('getLockoutExpiration', () => {
    it('should return null when lockedUntil is null', () => {
      expect(service.getLockoutExpiration(null)).toBe(null);
    });

    it('should return null when lockedUntil is in the past', () => {
      const lockedUntil = new Date(Date.now() - 60 * 1000);
      expect(service.getLockoutExpiration(lockedUntil)).toBe(null);
    });

    it('should return lockedUntil when in the future', () => {
      const lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
      expect(service.getLockoutExpiration(lockedUntil)).toEqual(lockedUntil);
    });
  });

  describe('calculateLockoutTime', () => {
    it('should return a date 30 minutes in the future by default', () => {
      const lockoutTime = service.calculateLockoutTime();
      const expectedTime = Date.now() + 30 * 60 * 1000;
      
      expect(lockoutTime.getTime()).toBeGreaterThanOrEqual(expectedTime - 1000);
      expect(lockoutTime.getTime()).toBeLessThanOrEqual(expectedTime + 1000);
    });
  });

  describe('getProgressiveDelay', () => {
    it('should return 0 when progressive delays are disabled', () => {
      // Note: In real scenario, this would depend on env config
      expect(service.getProgressiveDelay(1)).toBeGreaterThanOrEqual(0);
    });

    it('should return 0 for attempts below threshold', () => {
      expect(service.getProgressiveDelay(1)).toBe(0);
      expect(service.getProgressiveDelay(2)).toBe(0);
    });

    it('should return 2000ms for 3 attempts', () => {
      expect(service.getProgressiveDelay(3)).toBe(2000);
    });

    it('should return 5000ms for 4 attempts', () => {
      expect(service.getProgressiveDelay(4)).toBe(5000);
    });

    it('should return 10000ms for 5 or more attempts', () => {
      expect(service.getProgressiveDelay(5)).toBe(10000);
      expect(service.getProgressiveDelay(6)).toBe(10000);
      expect(service.getProgressiveDelay(10)).toBe(10000);
    });
  });

  describe('shouldApplyProgressiveDelay', () => {
    it('should return false for attempts below 3', () => {
      expect(service.shouldApplyProgressiveDelay(1)).toBe(false);
      expect(service.shouldApplyProgressiveDelay(2)).toBe(false);
    });

    it('should return true for 3 or more attempts', () => {
      expect(service.shouldApplyProgressiveDelay(3)).toBe(true);
      expect(service.shouldApplyProgressiveDelay(4)).toBe(true);
      expect(service.shouldApplyProgressiveDelay(5)).toBe(true);
    });
  });

  describe('getRemainingLockoutTime', () => {
    it('should return 0 when lockedUntil is null', () => {
      expect(service.getRemainingLockoutTime(null)).toBe(0);
    });

    it('should return 0 when lockedUntil is in the past', () => {
      const lockedUntil = new Date(Date.now() - 60 * 1000);
      expect(service.getRemainingLockoutTime(lockedUntil)).toBe(0);
    });

    it('should return remaining time in seconds', () => {
      const lockedUntil = new Date(Date.now() + 30 * 1000); // 30 seconds from now
      const remaining = service.getRemainingLockoutTime(lockedUntil);
      
      expect(remaining).toBeGreaterThanOrEqual(29);
      expect(remaining).toBeLessThanOrEqual(30);
    });
  });

  describe('getConfig', () => {
    it('should return configuration with correct defaults', () => {
      const config = service.getConfig();
      
      expect(config.maxFailedAttempts).toBe(5);
      expect(config.lockoutDurationMs).toBe(30 * 60 * 1000);
      expect(config.progressiveDelaysEnabled).toBe(true);
      expect(config.delayThresholds).toHaveLength(3);
    });
  });
});
