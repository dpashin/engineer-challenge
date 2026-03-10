export interface ResetPasswordResult {
  success: boolean;
  error?: ResetPasswordError;
}

export enum ResetPasswordError {
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_ALREADY_USED = 'TOKEN_ALREADY_USED',
  INVALID_PASSWORD = 'INVALID_PASSWORD',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}
