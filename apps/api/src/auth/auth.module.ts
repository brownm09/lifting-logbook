import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ClerkAuthProvider } from '../adapters/clerk/clerk-auth.adapter';
import { DevAuthProvider } from '../adapters/dev/dev-auth.adapter';
import { AUTH_PROVIDER } from '../ports/tokens';
import { AuthGuard } from './auth.guard';

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
