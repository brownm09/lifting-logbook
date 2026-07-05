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
 * True when running in a deployed server runtime — i.e. a live Cloud Run / GKE container,
 * not local `next dev` and not `next build`. Used to decide whether a missing
 * `PUBLIC_API_URL` is a fatal misconfiguration (deployed) or an acceptable local-dev
 * fallback. `next build` sets `NEXT_PHASE === 'phase-production-build'`; it is excluded so
 * the guard never fires at build time — the keyless build the `force-dynamic` root layout
 * relies on (ADR-028) must not throw.
 */
function isDeployedServerRuntime(): boolean {
  return (
    process.env.NODE_ENV === 'production' &&
    process.env.NEXT_PHASE !== 'phase-production-build'
  );
}

/**
 * Assemble the public config from server-side process.env. Called in the root layout
 * (a Server Component) so the reads happen at request time and are NOT build-time
 * inlined — the variables deliberately have no `NEXT_PUBLIC_` prefix.
 *
 * In a deployed runtime a missing `PUBLIC_API_URL` is fatal: we throw rather than silently
 * fall back to localhost, which would ship a "healthy" production image whose browser calls
 * all connection-refuse — the exact silent-misconfig class behind #395/#458. The localhost
 * fallback is reserved for local dev and the SSR/client guard path (`getClientPublicConfig`).
 */
export function readServerPublicConfig(): PublicConfig {
  const devAuthToken = process.env.DEV_AUTH_TOKEN || undefined;
  // Treat an empty string as "unset": `gcloud run deploy --set-env-vars=PUBLIC_API_URL=`
  // resolves to '' if its source terraform output is empty, which must trip the guard too.
  const apiUrl = process.env.PUBLIC_API_URL || undefined;
  if (!apiUrl && isDeployedServerRuntime()) {
    throw new Error(
      'PUBLIC_API_URL is not set in a deployed runtime. The browser-facing API URL must be ' +
        'injected at deploy time (Cloud Run --set-env-vars / GKE ConfigMap). Refusing to ' +
        `fall back to ${PUBLIC_CONFIG_FALLBACK.apiUrl}, which would silently ship a broken ` +
        'image. See ADR-028 / issue #396.',
    );
  }
  return {
    apiUrl: apiUrl ?? PUBLIC_CONFIG_FALLBACK.apiUrl,
    defaultProgram: process.env.DEFAULT_PROGRAM || PUBLIC_CONFIG_FALLBACK.defaultProgram,
    ...(devAuthToken ? { devAuthToken } : {}),
  };
}

/**
 * Resolve the Clerk publishable key passed to <ClerkProvider>, failing loud on a deployed
 * misconfiguration. Mirrors readServerPublicConfig's PUBLIC_API_URL guard above (and the
 * API-side guard in apps/api/src/auth/auth.module.ts): a deployed runtime missing its Clerk
 * publishable key must refuse to render rather than hand <ClerkProvider> an `undefined` key,
 * which fails only later in the browser with no server-side signal — the same silent-misconfig
 * class as #395/#458, here for auth.
 *
 * An empty string is treated as unset (an empty `--set-env-vars=CLERK_PUBLISHABLE_KEY=` must
 * trip the guard too). Dev-auth mode is exempt: when `DEV_AUTH_TOKEN` is set a missing key is
 * intentional, mirroring the API-side guard where an unset `CLERK_SECRET_KEY` selects
 * `DevAuthProvider` rather than failing. Never throws during `next build` (phase-production-build)
 * — the keyless build the force-dynamic root layout relies on must not throw (ADR-028) — nor in
 * local dev or tests, where a missing key returns `undefined` unchanged. See #687.
 */
export function readServerClerkPublishableKey(): string | undefined {
  const key = process.env.CLERK_PUBLISHABLE_KEY || undefined;
  if (!key && isDeployedServerRuntime() && !process.env.DEV_AUTH_TOKEN) {
    throw new Error(
      'CLERK_PUBLISHABLE_KEY is not set in a deployed runtime. Clerk requires a publishable ' +
        'key injected at deploy time (Cloud Run --set-env-vars / GKE ConfigMap). Refusing to ' +
        'render <ClerkProvider> with an undefined key, which would break auth silently in the ' +
        'browser. See #687.',
    );
  }
  return key;
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
