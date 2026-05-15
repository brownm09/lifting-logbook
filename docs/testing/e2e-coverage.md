# E2E Test Coverage

This document maps every critical user flow to its test coverage across the API layer (in-memory adapter and DB/Prisma adapter) and the frontend layer. Updated whenever new test files are added.

## Critical User Flows

| Flow | API (in-mem) | API (DB) | Frontend |
|---|---|---|---|
| Log a workout (lift records) | ✅ | ✅ | ❌ |
| Onboarding — initialize first cycle | ❌ | ✅ | ❌ |
| Advance a cycle | ✅ | ✅ | ❌ |
| Recalculate training maxes | ✅ | ✅ | ❌ |
| Reschedule a workout | ✅ | ✅ | ❌ |
| Manage lifts (overrides) | ✅ | ✅ | ❌ |
| Training max history / mark PR | ✅ | ✅ | ❌ |
| Strength goals | ✅ | ✅ | ❌ |
| Import lift records (CSV) | ❌ | ✅ | ❌ |
| Body weight logging | ✅ | ✅† | ❌ |
| History page — lift records + TM history together | ✅ each | ✅ | ❌ |
| User settings (`GET`/`PATCH /users/me/settings`) | N/A‡ | ✅ | ❌ |
| Custom programs (`GET`/`POST /programs/custom`) | N/A‡ | ✅ | ❌ |
| Switch program (`POST /programs/:p/switch`) | N/A‡ | ✅ | ❌ |

**†** Body weight has no Prisma adapter. `BODY_WEIGHT_REPOSITORY` is always wired to `InMemoryBodyWeightRepository` — even when `DATABASE_URL` is set. The DB-spec test exercises the HTTP contract but cannot make DB-level persistence assertions.

**‡** User settings, custom programs, and switch program are backed exclusively by Prisma (no in-memory variant exists for these repositories).

## Test Files

| File | What it covers |
|---|---|
| `apps/api/src/programs/programs.e2e.spec.ts` | Full API surface via in-memory adapters. Runs on every `npm test`. |
| `apps/api/src/programs/programs.db.e2e.spec.ts` | Full API surface via Prisma adapters. Requires `DATABASE_URL`. Run with `npm run test:db -w @lifting-logbook/api`. |
| `apps/api/src/observability/otel.e2e.spec.ts` | OTel + nestjs-pino trace correlation smoke test. |
| `apps/api-legacy/tests/server.test.ts` | Legacy Express health check. |

## Frontend Coverage Gap

No browser-level E2E tests exist. There is no Playwright or Cypress configuration in the repository. Every user-facing page — workout logger, onboarding, history, training maxes settings, programs, strength goals — is tested only by manual verification.

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
# In-memory suite (no DB required):
npm test -w @lifting-logbook/api

# DB suite (requires DATABASE_URL):
DATABASE_URL=postgresql://lifting:lifting@localhost:5433/lifting_test \
  npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
npm run test:db -w @lifting-logbook/api

# Local DB via Docker:
docker-compose -f docker-compose.test.yml up -d
```
