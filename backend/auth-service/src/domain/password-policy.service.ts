/**
 * Password Policy Domain Service
 * 
 * Enforces password requirements:
 * - Minimum length: 8 characters
 * - Must contain uppercase letters (A-Z)
 * - Must contain lowercase letters (a-z)
 * - Must contain digits (0-9)
 * - Must contain special characters (!@#$%^&* etc.)
 */
export class PasswordPolicyService {
  private static readonly MIN_LENGTH = 8;
  private static readonly UPPERCASE_REGEX = /[A-Z]/;
  private static readonly LOWERCASE_REGEX = /[a-z]/;
  private static readonly DIGIT_REGEX = /[0-9]/;
  private static readonly SPECIAL_CHAR_REGEX = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/;

  /**
   * Validates password against policy requirements
   * @param password - Plain text password to validate
   * @returns ValidationResult with isValid flag and array of violations
   */
  static validate(password: string): ValidationResult {
    const violations: PasswordViolation[] = [];

    if (password.length < this.MIN_LENGTH) {
      violations.push(PasswordViolation.TOO_SHORT);
    }

    if (!this.UPPERCASE_REGEX.test(password)) {
      violations.push(PasswordViolation.NO_UPPERCASE);
    }

    if (!this.LOWERCASE_REGEX.test(password)) {
      violations.push(PasswordViolation.NO_LOWERCASE);
    }

    if (!this.DIGIT_REGEX.test(password)) {
      violations.push(PasswordViolation.NO_DIGIT);
    }

    if (!this.SPECIAL_CHAR_REGEX.test(password)) {
      violations.push(PasswordViolation.NO_SPECIAL_CHAR);
    }

    return {
      isValid: violations.length === 0,
      violations,
    };
  }

  /**
   * Checks if password meets all policy requirements
   * @param password - Plain text password to check
   * @returns true if password is valid
   */
  static isValid(password: string): boolean {
    return this.validate(password).isValid;
  }
}

export enum PasswordViolation {
  TOO_SHORT = 'TOO_SHORT',
  NO_UPPERCASE = 'NO_UPPERCASE',
  NO_LOWERCASE = 'NO_LOWERCASE',
  NO_DIGIT = 'NO_DIGIT',
  NO_SPECIAL_CHAR = 'NO_SPECIAL_CHAR',
}

export interface ValidationResult {
  isValid: boolean;
  violations: PasswordViolation[];
}
