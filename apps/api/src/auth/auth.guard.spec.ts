import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { AuthGuard } from './auth.guard';
import { AUTH_PROVIDER } from '../ports/tokens';
import type { AuthUser } from '../ports/auth';

const mockUser: AuthUser = { id: 'user_1', email: 'test@example.com', provider: 'clerk' };
const mockAuthProvider = { verifyToken: jest.fn().mockResolvedValue(mockUser) };

function makeContext(headers: Record<string, string>, isPublic = false): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ headers, user: undefined }),
    }),
    // Reflector.getAllAndOverride is stubbed via the module; this lets the guard
    // read IS_PUBLIC_KEY without a real Reflector call.
    _isPublic: isPublic,
  } as unknown as ExecutionContext;
}

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    mockAuthProvider.verifyToken.mockClear();
    const module = await Test.createTestingModule({
      providers: [
        AuthGuard,
        {
          provide: Reflector,
          useValue: { getAllAndOverride: jest.fn().mockReturnValue(false) },
        },
        { provide: AUTH_PROVIDER, useValue: mockAuthProvider },
      ],
    }).compile();

    guard = module.get(AuthGuard);
    reflector = module.get(Reflector);
  });

  it('allows @Public() routes without a token', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);
    const ctx = makeContext({});
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(mockAuthProvider.verifyToken).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when no token header is present', async () => {
    const ctx = makeContext({});
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('prefers x-clerk-authorization over authorization when both are present', async () => {
    const clerkJwt = 'clerk-jwt-token';
    const gcpToken = 'gcp-identity-token';
    const request = { headers: { 'x-clerk-authorization': `Bearer ${clerkJwt}`, authorization: `Bearer ${gcpToken}` }, user: undefined };
    const ctx = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    await guard.canActivate(ctx);

    expect(mockAuthProvider.verifyToken).toHaveBeenCalledWith(clerkJwt);
    expect(request.user).toEqual(mockUser);
  });

  it('falls back to authorization when x-clerk-authorization is absent', async () => {
    const clerkJwt = 'clerk-jwt-token';
    const request = { headers: { authorization: `Bearer ${clerkJwt}` }, user: undefined };
    const ctx = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    await guard.canActivate(ctx);

    expect(mockAuthProvider.verifyToken).toHaveBeenCalledWith(clerkJwt);
    expect(request.user).toEqual(mockUser);
  });
});
