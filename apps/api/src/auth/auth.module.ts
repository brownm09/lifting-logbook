import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ClerkAuthProvider } from '../adapters/clerk/clerk-auth.adapter';
import { DevAuthProvider } from '../adapters/dev/dev-auth.adapter';
import { AUTH_PROVIDER } from '../ports/tokens';
import { AuthGuard } from './auth.guard';

// Fail fast if the variable is defined but empty — a common Helm/container
// misconfiguration that would otherwise silently fall back to DevAuthProvider.
if (process.env.CLERK_SECRET_KEY === '') {
  throw new Error(
    'CLERK_SECRET_KEY is set but empty — refusing to fall back to DevAuthProvider. ' +
      'Unset the variable entirely to use DevAuthProvider intentionally.',
  );
}

@Module({
  providers: [
    {
      provide: AUTH_PROVIDER,
      useClass: process.env.CLERK_SECRET_KEY
        ? ClerkAuthProvider
        : DevAuthProvider,
    },
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AuthModule {}
