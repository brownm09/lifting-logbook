// Browser-facing public configuration, injected at RUNTIME rather than baked into
// the JS bundle at build time. See ADR-028 / issue #396.
//
// Next.js inlines any `NEXT_PUBLIC_*` env var into the bundle at build time, which
// forced per-environment image builds (ADR-025) and broke build-once / promote-
// everywhere. These values intentionally carry NO `NEXT_PUBLIC_` prefix so Next.js
// does NOT inline them; the root layout (a Server Component) reads them from
// process.env at request time and delivers them to the browser two ways:
//   1. an inline <script> in <head> that sets window.__PUBLIC_CONFIG__ before
//      hydration — consumed by the non-React module lib/client-api.ts, and
//   2. as a prop to <PublicConfigProvider> for React components, via usePublicConfig().
//
// This module holds only the type, the fallbacks, and the server-side assembly /
// serialization helpers, so it is safe to import from both server and client code
// (the React provider/hook live in components/PublicConfigProvider.tsx).

export interface PublicConfig {
  /** Browser-facing API base URL (external; distinct from the server-side `API_URL`). */
  apiUrl: string;
  /** Default training program slug. */
  defaultProgram: string;
  /**
   * Dev/Playwright bearer token. Present ONLY when `DEV_AUTH_TOKEN` is set (local dev,
   * Playwright CI) — never in deployed environments, so it is never exposed to browsers
   * in staging/production. Mirrors the exposure of the former `NEXT_PUBLIC_DEV_AUTH_TOKEN`.
   */
  devAuthToken?: string;
}

declare global {
  interface Window {
    __PUBLIC_CONFIG__?: PublicConfig;
  }
}

/** Local-dev fallbacks used when no runtime config has been injected. */
export const PUBLIC_CONFIG_FALLBACK: PublicConfig = {
  apiUrl: 'http://localhost:3004',
  defaultProgram: '5-3-1',
};

/**
 * Assemble the public config from server-side process.env. Called in the root layout
 * (a Server Component) so the reads happen at request time and are NOT build-time
 * inlined — the variables deliberately have no `NEXT_PUBLIC_` prefix.
 */
export function readServerPublicConfig(): PublicConfig {
  const devAuthToken = process.env.DEV_AUTH_TOKEN || undefined;
  return {
    apiUrl: process.env.PUBLIC_API_URL ?? PUBLIC_CONFIG_FALLBACK.apiUrl,
    defaultProgram: process.env.DEFAULT_PROGRAM ?? PUBLIC_CONFIG_FALLBACK.defaultProgram,
    ...(devAuthToken ? { devAuthToken } : {}),
  };
}

/**
 * Build the inline-<script> body that sets window.__PUBLIC_CONFIG__ before React
 * hydrates. The `<` escape prevents a value containing `</script>` from breaking out
 * of the element (defense-in-depth — these values are GCP-controlled, but escape anyway).
 */
export function publicConfigScript(config: PublicConfig): string {
  const json = JSON.stringify(config).replace(/</g, '\\u003c');
  return `window.__PUBLIC_CONFIG__=${json};`;
}

/**
 * Read the runtime-injected config in the browser, falling back to dev defaults when
 * the inline script has not run (e.g. during SSR, where `window` is undefined). Used by
 * the non-React module lib/client-api.ts; React components should prefer usePublicConfig().
 */
export function getClientPublicConfig(): PublicConfig {
  if (typeof window !== 'undefined' && window.__PUBLIC_CONFIG__) {
    return window.__PUBLIC_CONFIG__;
  }
  return PUBLIC_CONFIG_FALLBACK;
}
