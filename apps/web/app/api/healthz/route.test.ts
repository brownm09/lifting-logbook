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

  // Regression test for #382 / #385: a Clerk-init failure must fail readiness,
  // not be hidden behind a 200 from a statically-rendered page.
  it('returns 503 with the error message when Clerk auth() throws', async () => {
    delete process.env.DEV_AUTH_TOKEN;
    mockedAuth.mockRejectedValueOnce(new Error('Missing CLERK_SECRET_KEY'));

    const res = await GET();

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      ok: false,
      error: 'Missing CLERK_SECRET_KEY',
    });
  });

  it('skips Clerk and returns ok:true in DEV_AUTH_TOKEN mode', async () => {
    process.env.DEV_AUTH_TOKEN = 'dev-token';

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, mode: 'dev-auth' });
    expect(mockedAuth).not.toHaveBeenCalled();
  });
});
