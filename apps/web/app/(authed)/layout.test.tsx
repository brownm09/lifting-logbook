import React from 'react';
import AuthedLayout from './layout';
import AppNav from './AppNav';

jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  redirect: jest.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

const mockedAuth = auth as unknown as jest.Mock;
const mockedRedirect = redirect as unknown as jest.Mock;

const SENTINEL = 'protected-children-sentinel' as unknown as React.ReactNode;

describe('(authed) layout — defense-in-depth auth guard', () => {
  const originalDevToken = process.env.DEV_AUTH_TOKEN;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.DEV_AUTH_TOKEN;
    // Jest default NODE_ENV is 'test'; ensure each test starts from a known non-production value.
    (process.env as Record<string, string>).NODE_ENV = 'test';
  });

  afterAll(() => {
    if (originalDevToken === undefined) {
      delete process.env.DEV_AUTH_TOKEN;
    } else {
      process.env.DEV_AUTH_TOKEN = originalDevToken;
    }
    (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;
  });

  it('redirects unauthenticated requests to /sign-in', async () => {
    mockedAuth.mockResolvedValue({ userId: null });

    await expect(
      AuthedLayout({ children: SENTINEL }),
    ).rejects.toThrow('REDIRECT:/sign-in');

    expect(mockedRedirect).toHaveBeenCalledWith('/sign-in');
  });

  it('renders children verbatim for authenticated requests', async () => {
    mockedAuth.mockResolvedValue({ userId: 'user_123' });

    const element = (await AuthedLayout({ children: SENTINEL })) as React.ReactElement;

    expect(mockedRedirect).not.toHaveBeenCalled();
    expect(element.type).toBe(React.Fragment);
    // The shell now renders the global app nav alongside the protected content,
    // which still passes through verbatim as the last child.
    const kids = (element.props as { children: React.ReactNode[] }).children;
    expect((kids[0] as React.ReactElement).type).toBe(AppNav);
    expect(kids[kids.length - 1]).toBe(SENTINEL);
  });

  it('bypasses Clerk in non-production when DEV_AUTH_TOKEN is set', async () => {
    process.env.DEV_AUTH_TOKEN = 'dev-token';

    const element = (await AuthedLayout({ children: SENTINEL })) as React.ReactElement;

    expect(mockedAuth).not.toHaveBeenCalled();
    expect(mockedRedirect).not.toHaveBeenCalled();
    expect(element.type).toBe(React.Fragment);
    const kids = (element.props as { children: React.ReactNode[] }).children;
    expect((kids[0] as React.ReactElement).type).toBe(AppNav);
    expect(kids[kids.length - 1]).toBe(SENTINEL);
  });

  it('ignores DEV_AUTH_TOKEN in production and still calls auth()', async () => {
    process.env.DEV_AUTH_TOKEN = 'leaked-into-prod';
    (process.env as Record<string, string>).NODE_ENV = 'production';
    mockedAuth.mockResolvedValue({ userId: null });

    await expect(
      AuthedLayout({ children: SENTINEL }),
    ).rejects.toThrow('REDIRECT:/sign-in');

    expect(mockedAuth).toHaveBeenCalled();
    expect(mockedRedirect).toHaveBeenCalledWith('/sign-in');
  });
});
