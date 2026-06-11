# ADR-028: Runtime Injection of apps/web Public Config

**Status:** Accepted
**Date:** 2026-06-11
**Closes:** [#396](https://github.com/brownm09/lifting-logbook/issues/396)
**Supersedes:** [ADR-025](ADR-025-web-image-per-env-build.md) (per-environment web image build)
**Related:** [ADR-022](ADR-022-monorepo-docker-build-strategy.md) (web Dockerfile structure), [ADR-009](ADR-009-infrastructure-kubernetes-cloud-run.md) (deploy targets), [#388](https://github.com/brownm09/lifting-logbook/issues/388) (Phase 1)

---

## Context

Next.js inlines any `NEXT_PUBLIC_*` environment variable into the client JS bundle **at build
time** — the value is substituted into the compiled JavaScript and frozen into the container
image. Two such variables drove `apps/web`:

- `NEXT_PUBLIC_API_URL` — the API URL the browser calls.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — the Clerk frontend key `<ClerkProvider>` requires.

[ADR-025](ADR-025-web-image-per-env-build.md) (Phase 1, [#388](https://github.com/brownm09/lifting-logbook/issues/388))
fixed a real bug — staging values baked into an image then shipped unchanged to production —
by building the web image **twice per pipeline run**, once per environment. That restored
correct per-env values but **broke build-once / promote-everywhere**: the artifact the staging
gate exercises (`web:<sha>-staging`) is no longer byte-identical to the one production runs
(`web:<sha>-prod`). ADR-025 named this as an explicit, temporary trade and deferred the real
fix — eliminating build-time embedding — to this Phase 2.

## Decision

Inject the public config at **runtime** and build the web image **once**. The root layout is a
Server Component, so it reads `process.env` at request time (not at build); the variables are
renamed to drop the `NEXT_PUBLIC_` prefix so Next.js does **not** inline them.

Two complementary delivery mechanisms, both sourced from a single read in the root layout:

1. **`<ClerkProvider publishableKey={process.env.CLERK_PUBLISHABLE_KEY}>`** — Clerk's documented
   runtime-key pattern. Passing the key as a prop is SSR-safe and needs no browser global for
   Clerk's synchronous client mount. (This is why the rejected "Server-Component + context only"
   shape does not work: it cannot supply the key before `<ClerkProvider>` mounts.)
2. **An inline `<script>` in `<head>`** sets `window.__PUBLIC_CONFIG__ = { apiUrl, defaultProgram,
   devAuthToken }` before hydration, so it is present before the non-React module
   `lib/client-api.ts` evaluates or any client fetch fires. The same object is passed as a prop
   to a `PublicConfigProvider` so React components read it via `usePublicConfig()` (SSR-correct).

The root layout sets `export const dynamic = 'force-dynamic'` so these reads happen per request
rather than being evaluated once during build-time static prerendering (which would re-bake
build values and defeat the whole point). `lib/client-api.ts` resolves its base URL lazily — the
API client's `baseUrl` accepts a `() => string` thunk (`packages/api-client`) that reads the
injected value per request. `apps/web/Dockerfile` no longer declares any `ARG NEXT_PUBLIC_*`.

**Env-var renames (build-time → runtime):**

| Old (inlined at build) | New (read at runtime) | Read where |
|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `CLERK_PUBLISHABLE_KEY` | layout → `<ClerkProvider>` prop |
| `NEXT_PUBLIC_API_URL` (browser) | `PUBLIC_API_URL` | layout → `window.__PUBLIC_CONFIG__` → `client-api.ts` |
| `NEXT_PUBLIC_DEFAULT_PROGRAM` | `DEFAULT_PROGRAM` | `lib/active-program.ts` (server-only) |
| `NEXT_PUBLIC_DEV_AUTH_TOKEN` | reuse server `DEV_AUTH_TOKEN` | layout → `window.__PUBLIC_CONFIG__` |

`PUBLIC_API_URL` is the **browser-facing** API URL and stays distinct from the server-side
`API_URL`: on Cloud Run they are the same external URL, but on GKE `API_URL` is cluster-internal
while `PUBLIC_API_URL` must be the external endpoint the browser can reach.

The deploy pipeline collapses to a single env-agnostic `web:<sha>` build; per-env values are
supplied by the deploy step (`--set-env-vars` / `--update-secrets` on Cloud Run; ConfigMap +
Secret on GKE), exactly as `CLERK_SECRET_KEY` already was.

## Consequences

**Positive:**
- **Build-once / promote-everywhere restored.** The staging gate exercises the exact artifact
  deployed to production — the strongest form of the promotion contract.
- One fewer Docker build per pipeline run (faster, cheaper CI; ~halves web build time and AR
  storage versus ADR-025).
- Adding a new public value no longer requires wiring two build invocations and two secret
  lookups — it is one runtime env var on the deploy step.
- No build-time secret resolution in `build-images`; the Clerk publishable key is validated at
  the existing pre-promote gate instead.

**Negative:**
- The root layout is now `force-dynamic`, opting the app out of static prerendering. Acceptable:
  the app is auth-gated and already rendered dynamically in practice.
- A new failure mode: if the deploy step omits `PUBLIC_API_URL` / `CLERK_PUBLISHABLE_KEY`, the
  app serves dev fallbacks / a missing Clerk key at runtime rather than failing the build. The
  pre-promote auth-secret validation (production) and the runtime verification in
  [`docs/deploy.md`](../deploy.md) cover this.
- Public values are now visible in `window.__PUBLIC_CONFIG__` in page source. These are
  non-secret by definition (publishable key, API URL); `devAuthToken` is emitted only when
  `DEV_AUTH_TOKEN` is set, i.e. never in deployed environments — identical exposure to the
  former `NEXT_PUBLIC_DEV_AUTH_TOKEN`.

## Alternatives Considered

### Server Component + React context only (no window global)

Fetch config in a Server Component and pass it through context. **Rejected:** context is not
available to `<ClerkProvider>` on its synchronous client mount, nor to the non-React
`lib/client-api.ts` module. The inline `<script>` is what guarantees availability before
hydration.

### Keep build-time embedding, keep ADR-025's two builds

The status quo. **Rejected:** it is exactly what this ADR exists to undo — it permanently
forfeits the promotion contract.

## Verification

- **Build:** `npm run build` succeeds with no `NEXT_PUBLIC_*` build-args and the `force-dynamic`
  root layout (no `/_not-found` prerender crash from a missing Clerk key).
- **Tests:** `packages/api-client` covers thunk-`baseUrl` resolution; `apps/web` covers
  `readServerPublicConfig`, the inline-script serialization/escaping, the browser read of
  `window.__PUBLIC_CONFIG__`, the `usePublicConfig` provider, and that `client-api` prefixes
  requests with the injected `apiUrl`. Playwright smoke (`npm run test:e2e -w @lifting-logbook/web`).
- **CI:** `deploy.yml` builds `web:<sha>` once and promotes it; staging and production deploy
  steps inject the per-env values at runtime.
- **Runtime check (replaces ADR-025's bundle-grep):** see [`docs/deploy.md`](../deploy.md) →
  "Verifying runtime public config" — confirm neither environment's values are present in the
  JS bundle (they are injected at runtime), and that each served page emits the correct
  `window.__PUBLIC_CONFIG__`.

## References

- [Next.js — Configuring Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables) —
  `NEXT_PUBLIC_*` values are inlined into the browser bundle at build time and fixed thereafter;
  variables without the prefix are read on the server at runtime. This is the root constraint
  the rename works around.
- [Next.js — Route Segment Config: `dynamic`](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config#dynamic) —
  `force-dynamic` opts a segment out of static generation so server-side `process.env` reads
  happen per request.
- [Clerk — `<ClerkProvider>` `publishableKey` prop](https://clerk.com/docs/components/clerk-provider) —
  The publishable key may be passed explicitly as a prop (the runtime-key pattern) instead of
  relying on build-time env inlining.
- [OWASP — Cross-Site Scripting (XSS) Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html) —
  Rationale for escaping `<` when serializing JSON into an inline `<script>` element (prevents
  `</script>` breakout), applied defensively in `publicConfigScript`.
