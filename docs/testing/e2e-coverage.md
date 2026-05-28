# E2E Test Coverage

This document maps every critical user flow to its test coverage across the API layer (in-memory adapter and DB/Prisma adapter) and the frontend layer. Updated whenever new test files are added.

## Critical User Flows

| Flow | API (in-mem) | API (DB) | Frontend |
|---|---|---|---|
| Log a workout (lift records) | ✅ | ✅ | ✅ |
| Onboarding — initialize first cycle | ❌ | ✅ | ✅ |
| Advance a cycle | ✅ | ✅ | ❌ |
| Recalculate training maxes | ✅ | ✅ | ❌ |
| Reschedule a workout | ✅ | ✅ | ❌ |
| Manage lifts (overrides) | ✅ | ✅ | ❌ |
| Training max history / mark PR | ✅ | ✅ | ✅ |
| Strength goals | ✅ | ✅ | ✅ |
| Import lift records (CSV) | ❌ | ✅ | ❌ |
| Body weight logging | ✅ | ✅† | ❌ |
| History page — lift records + TM history together | ✅ each | ✅ | ✅ |
| User settings (`GET`/`PATCH /users/me/settings`) | N/A‡ | ✅ | ❌ |
| Custom programs (`GET`/`POST /programs/custom`) | N/A‡ | ✅ | ❌ |
| Switch program (`POST /programs/:p/switch`) | N/A‡ | ✅ | ✅ |

**†** Body weight has no Prisma adapter. `BODY_WEIGHT_REPOSITORY` is always wired to `InMemoryBodyWeightRepository` — even when `DATABASE_URL` is set. The DB-spec test exercises the HTTP contract but cannot make DB-level persistence assertions.

**‡** User settings, custom programs, and switch program are backed exclusively by Prisma (no in-memory variant exists for these repositories).

## Test Files

| File | What it covers |
|---|---|
| `apps/api/src/programs/programs.e2e.spec.ts` | Full API surface via in-memory adapters. Runs on every `npm test`. |
| `apps/api/src/programs/programs.db.e2e.spec.ts` | Full API surface via Prisma adapters. Postgres is auto-provisioned by Jest globalSetup (Testcontainers locally; service container in CI). Runs on every `npm test -w @lifting-logbook/api` when Docker is available. |
| `apps/api/src/observability/otel.e2e.spec.ts` | OTel + nestjs-pino trace correlation smoke test. |
| `apps/api-legacy/tests/server.test.ts` | Legacy Express health check. |

## Frontend E2E Tests

Playwright smoke tests live in `apps/web/e2e/smoke.spec.ts`. They run against a lightweight
mock API server (`apps/web/e2e/mock-api.mjs`) that Playwright starts alongside the Next.js dev
server. No real database or running API is required.

**Architecture note:** Next.js server components make API calls server-side, so `page.route()`
cannot intercept them. The mock server handles both server-side (Next.js → API) and browser-side
(`client-api.ts` → API) fetch calls by listening on the same port (3004) that both consumers target.

### Running locally

```bash
# Install browsers once
npx playwright install chromium --with-deps

# Run tests (starts mock API + Next.js dev server automatically)
npm run test:e2e -w @lifting-logbook/web

# Headed mode for debugging
npx playwright test --headed --project=chromium
```

### CI

The `e2e` job in `.github/workflows/ci.yml` runs after `lint-and-test` passes. Failures upload an
HTML report as a GitHub Actions artifact (`playwright-report`).

Tracking issue: [#259](https://github.com/brownm09/lifting-logbook/issues/259)

## Pages and the API Endpoints They Call

| Page | Endpoints |
|---|---|
| `/history` | `GET /programs/:p/lift-records`, `GET /programs/:p/training-maxes/history` |
| `/onboarding` (final step only) | `POST /programs/:p/cycles/initialize` |
| `/programs` | `GET /users/me/settings`, `GET /programs/custom` |
| Programs — switch | `POST /programs/:p/switch` |
| `/settings/training-maxes` | `GET /programs/:p/training-maxes`, `PATCH /programs/:p/training-maxes`, `GET /programs/:p/training-maxes/history` |
| `/settings/strength-goals` | `GET /programs/:p/strength-goals`, `PUT /programs/:p/strength-goals/:lift`, `DELETE /programs/:p/strength-goals/:lift` |

## Running the Tests

```bash
# Full suite (in-memory + DB). With Docker running, Jest globalSetup spins up
# a Postgres testcontainer automatically and runs migrations before tests:
npm test -w @lifting-logbook/api

# DB suite only:
npm run test:db -w @lifting-logbook/api

# CI passthrough: when DATABASE_URL is already set (e.g. the GitHub Actions
# postgres service container), globalSetup uses it directly and skips
# container startup. Run migrations yourself in this case before invoking jest.
```

> **Docker prerequisite.** Without Docker, globalSetup fails fast with a
> clear Testcontainers error. The DB E2E describe block then skips
> (`LIFTING_TC_DATABASE_URL` is unset), letting the rest of the suite still
> run if you need to iterate on non-DB code.
