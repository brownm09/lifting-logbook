import { CallHandler, ExecutionContext, InternalServerErrorException } from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';
import { lastValueFrom, of } from 'rxjs';
import { RlsInterceptor } from './rls.interceptor';
import { PrismaService } from './prisma.service';

function makeCls(): ClsService {
  const store = new Map<string, unknown>();
  return {
    get: jest.fn((key: string) => store.get(key)),
    set: jest.fn((key: string, value: unknown) => store.set(key, value)),
  } as unknown as ClsService;
}

function makeReflector(): Reflector {
  return { getAllAndOverride: jest.fn(() => undefined) } as unknown as Reflector;
}

function makeModuleRef(resolved: PrismaService | null): ModuleRef {
  return { get: jest.fn(() => resolved) } as unknown as ModuleRef;
}

// A real reflection target is required by Reflector.getAllAndOverride, but none of the tests below
// reach that call — the interceptor resolves (throw or no-op) before request/handler data is read.
const dummyHandler = function handler() {};
class DummyController {}

function makeContext(type: 'http' | 'rpc'): ExecutionContext {
  return {
    getType: () => type,
    switchToHttp: () => {
      throw new Error('switchToHttp should not be called before the Prisma/DATABASE_URL guard resolves');
    },
    getHandler: () => dummyHandler,
    getClass: () => DummyController,
  } as unknown as ExecutionContext;
}

const passthroughHandler: CallHandler = { handle: () => of('handled') };

// Stubs the private isDatabaseUrlConfigured() seam directly rather than mutating process.env —
// jest.env.setup.js wraps process.env in a Proxy that discards writes to DATABASE_URL outside the
// Testcontainers sentinel, so this is the only way to unit-test the branch without Docker.
function stubDatabaseUrlConfigured(interceptor: RlsInterceptor, value: boolean): void {
  jest
    .spyOn(interceptor as unknown as { isDatabaseUrlConfigured(): boolean }, 'isDatabaseUrlConfigured')
    .mockReturnValue(value);
}

describe('RlsInterceptor', () => {
  describe('when PrismaService cannot be resolved and a real DB is expected (DATABASE_URL configured)', () => {
    it('throws InternalServerErrorException instead of silently no-oping (issue #649)', () => {
      const interceptor = new RlsInterceptor(makeCls(), makeReflector(), makeModuleRef(null));
      stubDatabaseUrlConfigured(interceptor, true);

      expect(() => interceptor.intercept(makeContext('http'), passthroughHandler)).toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('when PrismaService cannot be resolved and no DB is configured (in-memory/SystemDb mode)', () => {
    it('no-ops and runs the request on next.handle() without throwing', async () => {
      const interceptor = new RlsInterceptor(makeCls(), makeReflector(), makeModuleRef(null));
      stubDatabaseUrlConfigured(interceptor, false);

      const result = await lastValueFrom(
        interceptor.intercept(makeContext('http'), passthroughHandler),
      );
      expect(result).toBe('handled');
    });
  });

  describe('non-HTTP context', () => {
    it('no-ops regardless of Prisma/DATABASE_URL state — RLS is HTTP-only today (issue #511)', async () => {
      const interceptor = new RlsInterceptor(makeCls(), makeReflector(), makeModuleRef(null));
      stubDatabaseUrlConfigured(interceptor, true);

      const result = await lastValueFrom(
        interceptor.intercept(makeContext('rpc'), passthroughHandler),
      );
      expect(result).toBe('handled');
    });
  });
});
