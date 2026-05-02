import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createClerkClient, verifyToken } from '@clerk/backend';
import { AuthUser, IAuthProvider } from '../../ports/auth';

@Injectable()
export class ClerkAuthProvider implements IAuthProvider {
  private readonly client = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY,
  });

  async verifyToken(token: string): Promise<AuthUser> {
    // Step 1: verify the JWT — throws UnauthorizedException on invalid/expired token
    let sub: string;
    try {
      const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY!,
        ...(process.env.CLERK_AUTHORIZED_PARTY
          ? { authorizedParties: [process.env.CLERK_AUTHORIZED_PARTY] }
          : {}),
      });
      sub = payload.sub;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // Step 2: fetch user profile — throws ServiceUnavailableException on Clerk API error
    try {
      const user = await this.client.users.getUser(sub);
      return {
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress ?? '',
        provider: 'clerk',
        displayName: user.fullName ?? undefined,
      };
    } catch {
      throw new ServiceUnavailableException('Auth service unavailable');
    }
  }
}
