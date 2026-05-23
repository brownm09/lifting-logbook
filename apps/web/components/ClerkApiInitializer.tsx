'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect } from 'react';
import { setAuthTokenGetter } from '@/lib/client-api';

export function ClerkApiInitializer() {
  const { getToken } = useAuth();

  useEffect(() => {
    setAuthTokenGetter(getToken);
  }, [getToken]);

  return null;
}
