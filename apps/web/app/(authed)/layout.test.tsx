import AuthedLayout from './layout';

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

describe('(authed) layout — defense-in-depth auth guard', () => {
  const originalDevToken = process.env.DEV_AUTH_TOKEN;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.DEV_AUTH_TOKEN;
  });

  afterAll(() => {
    if (originalDevToken === undefined) {
      delete process.env.DEV_AUTH_TOKEN;
    } else {
      process.env.DEV_AUTH_TOKEN = originalDevToken;
    }
  });

  it('redirects unauthenticated requests to /sign-in', async () => {
    mockedAuth.mockResolvedValue({ userId: null });

    await expect(
      AuthedLayout({ children: 'protected' as unknown as React.ReactNode }),
    ).rejects.toThrow('REDIRECT:/sign-in');

    expect(mockedRedirect).toHaveBeenCalledWith('/sign-in');
  });

  it('renders children for authenticated requests', async () => {
    mockedAuth.mockResolvedValue({ userId: 'user_123' });

    const element = await AuthedLayout({
      children: 'protected' as unknown as React.ReactNode,
    });

    expect(mockedRedirect).not.toHaveBeenCalled();
    expect(element).toBeTruthy();
  });

  it('skips Clerk entirely when DEV_AUTH_TOKEN is set', async () => {
    process.env.DEV_AUTH_TOKEN = 'dev-token';

    const element = await AuthedLayout({
      children: 'protected' as unknown as React.ReactNode,
    });

    expect(mockedAuth).not.toHaveBeenCalled();
    expect(mockedRedirect).not.toHaveBeenCalled();
    expect(element).toBeTruthy();
  });
});
