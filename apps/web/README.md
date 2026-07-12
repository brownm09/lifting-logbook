# @lifting-logbook/web

Next.js (App Router) frontend for Lifting Logbook. Talks to the NestJS API in
[`apps/api`](../api) and shares domain logic via the `packages/*` workspaces.

## Local development

### 1. Install dependencies

From the repo root:

```bash
npm install
```

### 2. Create your local env file

The dev server reads local configuration from `apps/web/.env.local` (gitignored; Next.js
also loads `apps/web/.env`, which is what the repo's `scripts/dev-setup.sh` and the root
[`README.md`](../../README.md) use — either filename works). Copy the checked-in template —
its defaults work out of the box for local dev-auth mode:

```bash
# from the repo root
cp apps/web/.env.example apps/web/.env.local
```

The template ([`.env.example`](.env.example)) already points the web app at the local
API (`API_URL` / `PUBLIC_API_URL = http://localhost:3004`) and sets `DEV_AUTH_TOKEN`,
which enables **dev-auth mode** (see [Authentication](#authentication) below).

> **No Clerk key is needed for dev-auth mode.** When `DEV_AUTH_TOKEN` is set, the root
> layout ([`app/layout.tsx`](app/layout.tsx)) skips `<ClerkProvider>` entirely and
> [`middleware.ts`](middleware.ts) bypasses `clerkMiddleware()`, so Clerk is fully inert —
> `next dev` boots with no Clerk key and ClerkJS never initializes in the browser, so the
> console stays clean. (The template used to ship Clerk's public example key to satisfy a
> `<ClerkProvider>` startup check, which logged a benign *"unable to attribute this request
> to an instance"* console error; skipping the provider resolved both —
> [#828](https://github.com/brownm09/lifting-logbook/issues/828) /
> [#834](https://github.com/brownm09/lifting-logbook/issues/834).) Supply your own Clerk
> keys (below) only for a real sign-in flow.

### 3. Run the dev servers

The web app calls the API at `http://localhost:3004`, so start both. The API dev server
defaults to `:3004` (`PORT ?? '3004'`) and the web dev server to `:3000`.

**Option A — launch configs.** The repo root [`.claude/launch.json`](../../.claude/launch.json)
defines `api`, `web`, and `mobile` dev servers; start `api` and `web` from your editor /
Claude Code.

**Option B — terminals** (two shells, from the repo root):

```bash
npm run dev -w @lifting-logbook/api    # -> http://localhost:3004
npm run dev -w @lifting-logbook/web    # -> http://localhost:3000
```

Then open <http://localhost:3000>.

> The API needs Postgres for its data endpoints — see [`apps/api`](../api) for its own
> setup (`docker-compose`). The web app still renders in dev-auth mode without a fully
> provisioned API; only data-backed pages will show empty/error states until the API is up.

## Authentication

Two modes, selected by whether `DEV_AUTH_TOKEN` is set:

| | Dev-auth mode (local default) | Clerk mode (staging / production) |
|---|---|---|
| Trigger | `DEV_AUTH_TOKEN` set | `DEV_AUTH_TOKEN` unset |
| Middleware | `clerkMiddleware()` bypassed in [`middleware.ts`](middleware.ts) | Clerk protects all non-public routes |
| API auth | any `Bearer <token>` accepted as the user id (`DevAuthProvider`) | real Clerk session token |
| `<ClerkProvider>` | not rendered (root layout skips it) | wraps the app |
| `CLERK_PUBLISHABLE_KEY` | not needed (`<ClerkProvider>` skipped) | **required** — real `pk_` key |
| `CLERK_SECRET_KEY` | not needed (middleware bypassed) | **required** — real `sk_` secret |

For a real Clerk sign-in flow locally, unset `DEV_AUTH_TOKEN` and set your instance's real
`pk_` publishable key and `CLERK_SECRET_KEY` in `.env.local`, both from your
[Clerk dashboard](https://dashboard.clerk.com) → API Keys. Never commit real keys —
`.env` and `.env*.local` are gitignored.

## Environment variables

Public config is injected at **runtime**, not baked into the bundle at build time, so these
deliberately carry **no `NEXT_PUBLIC_` prefix** (the root layout reads them per request and
delivers them to the browser via `window.__PUBLIC_CONFIG__`). See
[`lib/public-config.ts`](lib/public-config.ts), [ADR-028](../../docs/adr/ADR-028-web-runtime-public-config.md),
and [#396](https://github.com/brownm09/lifting-logbook/issues/396).

| Variable | Required locally | Default | Purpose |
|---|---|---|---|
| `API_URL` | yes (has fallback) | `http://localhost:3004` | Server-side API base URL (Next.js process → API) |
| `PUBLIC_API_URL` | yes (has fallback) | `http://localhost:3004` | Browser-facing API base URL (injected at runtime) |
| `DEFAULT_PROGRAM` | no | `5-3-1` | Program slug used as the `:program` path param |
| `DEV_AUTH_TOKEN` | local only | `dev-user` | Enables dev-auth mode; sent as the bearer token |
| `CLERK_PUBLISHABLE_KEY` | no (dev-auth) | *(unset)* | Passed to `<ClerkProvider>`; required only for real-Clerk mode |
| `CLERK_SECRET_KEY` | no (dev-auth) | *(unset)* | Server-side Clerk SDK; only for real Clerk auth |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | no | *(unset)* | OTLP trace export endpoint |

## Testing

```bash
npm test -w @lifting-logbook/web          # Jest unit + component tests
npm run typecheck -w @lifting-logbook/web # tsc --noEmit (blocking CI gate)
npm run test:e2e -w @lifting-logbook/web  # Playwright E2E (see e2e/README.md)
```

The full monorepo suite runs from the repo root with `npm test`. See the root
[`CLAUDE.md`](../../CLAUDE.md) → Testing for the complete workflow, and
[`e2e/README.md`](e2e/README.md) for the Playwright setup.
