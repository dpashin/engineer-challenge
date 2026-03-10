export interface RequestPasswordResetResult {
  success: boolean;
  token?: string;
  error?: RequestPasswordResetError;
}

export enum RequestPasswordResetError {
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  RATE_LIMITED = 'RATE_LIMITED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}
