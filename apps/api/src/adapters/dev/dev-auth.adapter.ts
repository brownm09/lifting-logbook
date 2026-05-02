import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthUser, IAuthProvider } from '../../ports/auth';

@Injectable()
export class DevAuthProvider implements IAuthProvider {
  async verifyToken(token: string): Promise<AuthUser> {
    if (!token) throw new UnauthorizedException();
    // Use the token value as the user ID so different tokens → different users,
    // enabling per-user isolation tests without a real auth provider.
    // DEV_USER_ID overrides this for local dev when a fixed identity is preferred.
    const id = process.env.DEV_USER_ID ?? token;
    return {
      id,
      email: process.env.DEV_USER_EMAIL ?? `${id}@dev.example.com`,
      provider: 'dev',
    };
  }
}
