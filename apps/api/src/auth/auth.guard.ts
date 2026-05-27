import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IAuthProvider } from '../ports/auth';
import { AUTH_PROVIDER } from '../ports/tokens';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AUTH_PROVIDER) private readonly authProvider: IAuthProvider,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    // Server-to-server calls (apps/web) put the Clerk JWT in X-Clerk-Authorization to
    // avoid colliding with the GCP identity token in Authorization (required for Cloud
    // Run IAM). Browser clients and local dev continue using Authorization.
    const headerValue: string | undefined =
      (request.headers['x-clerk-authorization'] as string | undefined) ??
      (request.headers['authorization'] as string | undefined);
    const token = headerValue?.startsWith('Bearer ')
      ? headerValue.slice(7)
      : undefined;

    if (!token) throw new UnauthorizedException();

    request.user = await this.authProvider.verifyToken(token);
    return true;
  }
}
