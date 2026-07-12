import React from 'react';

// Mock the Clerk client surface so we can assert on a stable component identity
// without importing the real (browser-oriented) Clerk SDK. The page is never rendered
// here — we inspect the returned element tree structurally, matching app/layout.test.tsx.
jest.mock('@clerk/nextjs', () => ({
  SignIn: function SignIn() {
    return null;
  },
}));

import Page from './page';
import { SignIn } from '@clerk/nextjs';

/** Recursively true if any element in the tree has `.type === type`. */
function containsType(node: React.ReactNode, type: React.ElementType): boolean {
  if (!node || typeof node !== 'object') return false;
  if (Array.isArray(node)) return node.some((child) => containsType(child, type));
  const element = node as React.ReactElement;
  if (element.type === type) return true;
  const children = (element.props as { children?: React.ReactNode }).children;
  return containsType(children, type);
}

/** Recursively concatenate all plain-string text nodes in the tree. */
function textOf(node: React.ReactNode): string {
  if (typeof node === 'string') return node;
  if (!node || typeof node !== 'object') return '';
  if (Array.isArray(node)) return node.map(textOf).join('');
  const element = node as React.ReactElement;
  const children = (element.props as { children?: React.ReactNode }).children;
  return textOf(children);
}

describe('sign-in page — dev-auth guard (#834)', () => {
  const originalDevToken = process.env.DEV_AUTH_TOKEN;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.DEV_AUTH_TOKEN;
  });

  afterAll(() => {
    if (originalDevToken === undefined) delete process.env.DEV_AUTH_TOKEN;
    else process.env.DEV_AUTH_TOKEN = originalDevToken;
  });

  it('dev-auth mode: renders the bypass notice, not <SignIn/> (which needs a <ClerkProvider> the layout skips)', () => {
    process.env.DEV_AUTH_TOKEN = 'dev-user';

    const element = Page() as React.ReactElement;

    expect(containsType(element, SignIn)).toBe(false);
    expect(textOf(element)).toMatch(/dev-auth mode is active/i);
  });

  it('real-Clerk mode: renders <SignIn/>', () => {
    // DEV_AUTH_TOKEN stays unset (cleared in beforeEach).
    const element = Page() as React.ReactElement;

    expect(containsType(element, SignIn)).toBe(true);
  });
});
