export enum RateLimitType {
  LOGIN_BY_EMAIL = 'login:by_email',
  LOGIN_BY_IP = 'login:by_ip',
  REGISTER_BY_IP = 'register:by_ip',
  PASSWORD_RESET_BY_EMAIL = 'password_reset:by_email',
  PASSWORD_RESET_BY_IP = 'password_reset:by_ip',
  REGISTER_BY_EMAIL = 'register:by_email',
  TOKEN_REFRESH = 'token:refresh',
  API_GLOBAL = 'api:global',
}
