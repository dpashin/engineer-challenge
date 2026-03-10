export interface RequestPasswordResetResult {
  success: boolean;
  token?: string;
  error?: RequestPasswordResetError;
}

export enum RequestPasswordResetError {
  RATE_LIMITED = 'RATE_LIMITED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}
