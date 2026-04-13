export interface AuthUser {
  id: string;
  email: string;
  provider: string;
  displayName?: string;
}

export interface IAuthProvider {
  verifyToken(token: string): Promise<AuthUser>;
}
