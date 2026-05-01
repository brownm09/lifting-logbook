import { UnauthorizedException } from '@nestjs/common';
import { AuthUser, IAuthProvider } from '../../ports/auth';

export class DevAuthProvider implements IAuthProvider {
  async verifyToken(token: string): Promise<AuthUser> {
    if (!token) throw new UnauthorizedException();
    return {
      id: process.env.DEV_USER_ID ?? 'dev-user',
      email: process.env.DEV_USER_EMAIL ?? 'dev@example.com',
      provider: 'dev',
    };
  }
}
