import { ResetTokenPolicyService } from '../domain/reset-token-policy.service';

describe('ResetTokenPolicyService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getTokenExpirationDate', () => {
    it('should return date 10 minutes in the future', () => {
      const now = new Date('2024-01-01T12:00:00Z');
      jest.setSystemTime(now);

      const expiration = ResetTokenPolicyService.getTokenExpirationDate();
      const expected = new Date('2024-01-01T12:10:00Z');

      expect(expiration).toEqual(expected);
    });
  });

  describe('isExpired', () => {
    it('should return false for future expiration', () => {
      const now = new Date('2024-01-01T12:00:00Z');
      jest.setSystemTime(now);

      const future = new Date('2024-01-01T12:05:00Z');
      expect(ResetTokenPolicyService.isExpired(future)).toBe(false);
    });

    it('should return true for past expiration', () => {
      const now = new Date('2024-01-01T12:00:00Z');
      jest.setSystemTime(now);

      const past = new Date('2024-01-01T11:55:00Z');
      expect(ResetTokenPolicyService.isExpired(past)).toBe(true);
    });
  });

  describe('isBlockedByAttempts', () => {
    it('should return false for less than 3 failed attempts', () => {
      expect(ResetTokenPolicyService.isBlockedByAttempts(0)).toBe(false);
      expect(ResetTokenPolicyService.isBlockedByAttempts(1)).toBe(false);
      expect(ResetTokenPolicyService.isBlockedByAttempts(2)).toBe(false);
    });

    it('should return true for 3 or more failed attempts', () => {
      expect(ResetTokenPolicyService.isBlockedByAttempts(3)).toBe(true);
      expect(ResetTokenPolicyService.isBlockedByAttempts(4)).toBe(true);
      expect(ResetTokenPolicyService.isBlockedByAttempts(5)).toBe(true);
    });
  });

  describe('getBlockUntilDate', () => {
    it('should return date 30 minutes in the future', () => {
      const now = new Date('2024-01-01T12:00:00Z');
      jest.setSystemTime(now);

      const blockUntil = ResetTokenPolicyService.getBlockUntilDate();
      const expected = new Date('2024-01-01T12:30:00Z');

      expect(blockUntil).toEqual(expected);
    });
  });

  describe('getMaxFailedAttempts', () => {
    it('should return 3', () => {
      expect(ResetTokenPolicyService.getMaxFailedAttempts()).toBe(3);
    });
  });

  describe('getBlockDurationMinutes', () => {
    it('should return 30', () => {
      expect(ResetTokenPolicyService.getBlockDurationMinutes()).toBe(30);
    });
  });

  describe('getTokenExpirationMinutes', () => {
    it('should return 10', () => {
      expect(ResetTokenPolicyService.getTokenExpirationMinutes()).toBe(10);
    });
  });
});
