export class RevokeTokensCommand {
  constructor(
    public readonly userId: string,
    public readonly refreshToken?: string, // If provided, revoke only this token; otherwise revoke all
  ) {}
}
