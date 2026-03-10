export interface RegisterResult {
  success: boolean;
  userId?: string;
  email?: string;
  error?: RegisterError;
}

export enum RegisterError {
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  INVALID_PASSWORD = 'INVALID_PASSWORD',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}
