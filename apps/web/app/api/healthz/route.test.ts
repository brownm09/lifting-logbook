/**
 * @jest-environment node
 */
import { GET } from './route';

jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}));

import { auth } from '@clerk/nextjs/server';

const mockedAuth = auth as unknown as jest.Mock;

describe('GET /api/healthz', () => {
  const originalEnv = process.env.DEV_AUTH_TOKEN;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.DEV_AUTH_TOKEN;
    } else {
      process.env.DEV_AUTH_TOKEN = originalEnv;
    }
    mockedAuth.mockReset();
  });

  it('returns 200 with ok:true when Clerk auth() resolves', async () => {
    delete process.env.DEV_AUTH_TOKEN;
    mockedAuth.mockResolvedValueOnce({ userId: null });

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockedAuth).toHaveBeenCalledTimes(1);
  });

  // Regression test for #385: when auth() throws (e.g., the route fell outside
  // clerkMiddleware's matcher and the auth-status header is absent), the probe
  // must return 503 so readiness fails. The error message is logged server-side
  // but deliberately not included in the response body — see route.ts.
  it('returns 503 with no error body when auth() throws', async () => {
    delete process.env.DEV_AUTH_TOKEN;
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockedAuth.mockRejectedValueOnce(new Error('Missing CLERK_SECRET_KEY'));

    const res = await GET();

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false });
    // The original error is logged server-side for operators.
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[healthz]'),
      expect.objectContaining({ message: 'Missing CLERK_SECRET_KEY' }),
    );
    consoleErrorSpy.mockRestore();
  });

  it('skips Clerk and returns ok:true in DEV_AUTH_TOKEN mode', async () => {
    process.env.DEV_AUTH_TOKEN = 'dev-token';

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, mode: 'dev-auth' });
    expect(mockedAuth).not.toHaveBeenCalled();
  });
});
