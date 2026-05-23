'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect } from 'react';
import { setAuthTokenGetter } from '@/lib/client-api';

/**
 * Wires the Clerk session token into client-side API calls via setAuthTokenGetter.
 *
 * Ordering note: React fires useEffect bottom-up (children before parents). Any page
 * component that calls clientFetch in its own useEffect on mount will execute before
 * this initializer runs — meaning _getToken is still null for that request (→ 401).
 * For this reason, mount-time client fetches in child components should be avoided;
 * prefer interaction-triggered calls or server-side fetches via lib/api.ts instead.
 */
export function ClerkApiInitializer() {
  const { getToken } = useAuth();

  useEffect(() => {
    setAuthTokenGetter(getToken);
  }, [getToken]);

  return null;
}
