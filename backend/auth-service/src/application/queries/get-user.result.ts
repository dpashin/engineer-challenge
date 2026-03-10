export interface GetUserResult {
  found: boolean;
  user?: {
    id: string;
    email: string;
    createdAt: Date;
  };
}
