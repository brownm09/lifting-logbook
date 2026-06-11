'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { PUBLIC_CONFIG_FALLBACK, type PublicConfig } from '@/lib/public-config';

// React context delivering the runtime-injected PublicConfig to client components.
// The value is supplied by the root layout (a Server Component) as a prop, so it is
// correct during SSR as well as after hydration. See ADR-028 / issue #396.
//
// The non-React module lib/client-api.ts cannot consume a hook, so it reads
// window.__PUBLIC_CONFIG__ directly (set by the inline <head> script); this provider
// is the React-facing path for components that need the same values.
const PublicConfigContext = createContext<PublicConfig>(PUBLIC_CONFIG_FALLBACK);

export function PublicConfigProvider({
  config,
  children,
}: {
  config: PublicConfig;
  children: ReactNode;
}) {
  return <PublicConfigContext.Provider value={config}>{children}</PublicConfigContext.Provider>;
}

export function usePublicConfig(): PublicConfig {
  return useContext(PublicConfigContext);
}
