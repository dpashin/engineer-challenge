import { PasswordPolicyService, PasswordViolation } from '../domain/password-policy.service';

describe('PasswordPolicyService', () => {
  describe('validate', () => {
    it('should return valid for a strong password', () => {
      const result = PasswordPolicyService.validate('Test123!');
      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should reject password that is too short', () => {
      const result = PasswordPolicyService.validate('Test1!');
      expect(result.isValid).toBe(false);
      expect(result.violations).toContain(PasswordViolation.TOO_SHORT);
    });

    it('should reject password without uppercase', () => {
      const result = PasswordPolicyService.validate('test123!');
      expect(result.isValid).toBe(false);
      expect(result.violations).toContain(PasswordViolation.NO_UPPERCASE);
    });

    it('should reject password without lowercase', () => {
      const result = PasswordPolicyService.validate('TEST123!');
      expect(result.isValid).toBe(false);
      expect(result.violations).toContain(PasswordViolation.NO_LOWERCASE);
    });

    it('should reject password without digit', () => {
      const result = PasswordPolicyService.validate('Testtest!');
      expect(result.isValid).toBe(false);
      expect(result.violations).toContain(PasswordViolation.NO_DIGIT);
    });

    it('should reject password without special character', () => {
      const result = PasswordPolicyService.validate('Test1234');
      expect(result.isValid).toBe(false);
      expect(result.violations).toContain(PasswordViolation.NO_SPECIAL_CHAR);
    });

    it('should reject password with multiple violations', () => {
      const result = PasswordPolicyService.validate('test');
      expect(result.isValid).toBe(false);
      expect(result.violations).toContain(PasswordViolation.TOO_SHORT);
      expect(result.violations).toContain(PasswordViolation.NO_DIGIT);
      expect(result.violations).toContain(PasswordViolation.NO_SPECIAL_CHAR);
      expect(result.violations).toContain(PasswordViolation.NO_UPPERCASE);
    });
  });

  describe('isValid', () => {
    it('should return true for valid password', () => {
      expect(PasswordPolicyService.isValid('Test123!')).toBe(true);
    });

    it('should return false for invalid password', () => {
      expect(PasswordPolicyService.isValid('weak')).toBe(false);
    });
  });
});
