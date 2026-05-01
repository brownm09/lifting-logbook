import { createClerkClient, verifyToken } from '@clerk/backend';
import { UnauthorizedException } from '@nestjs/common';
import { AuthUser, IAuthProvider } from '../../ports/auth';

export class ClerkAuthProvider implements IAuthProvider {
  private readonly client = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY,
  });

  async verifyToken(token: string): Promise<AuthUser> {
    try {
      const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY!,
      });
      const user = await this.client.users.getUser(payload.sub);
      return {
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress ?? '',
        provider: 'clerk',
        displayName: user.fullName ?? undefined,
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
