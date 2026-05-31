import Home from './page';

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

describe('root page — signed-in redirect', () => {
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

  it('redirects signed-in users to /cycle', async () => {
    mockedAuth.mockResolvedValue({ userId: 'user_123' });

    await expect(Home()).rejects.toThrow('REDIRECT:/cycle');
    expect(mockedRedirect).toHaveBeenCalledWith('/cycle');
  });

  it('renders the marketing card for unauthenticated visitors', async () => {
    mockedAuth.mockResolvedValue({ userId: null });

    const element = await Home();

    expect(mockedRedirect).not.toHaveBeenCalled();
    expect(element).toBeTruthy();
  });

  it('skips Clerk entirely when DEV_AUTH_TOKEN is set', async () => {
    process.env.DEV_AUTH_TOKEN = 'dev-token';

    const element = await Home();

    expect(mockedAuth).not.toHaveBeenCalled();
    expect(mockedRedirect).not.toHaveBeenCalled();
    expect(element).toBeTruthy();
  });
});
