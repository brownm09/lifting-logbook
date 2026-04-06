# ADR-013: Testing Strategy

**Status:** Accepted
**Date:** 2026-04-06

---

## Context

As implementation begins across `packages/core`, `apps/api`, `apps/web`, and `apps/mobile`, a
shared testing strategy is needed before any tests are written. Without it, different packages
will make incompatible choices about tooling, test doubles, and coverage targets, creating
maintenance debt and inconsistent confidence signals.

Three questions are unresolved:

1. **Test pyramid** — what ratio of unit / integration / e2e tests is appropriate, and what
   tooling supports each layer?
2. **Repository adapter integration tests** — should adapter tests hit a real database/store, a
   test double, or an in-memory implementation?
3. **Dual-transport test scope** — REST and GraphQL share the same NestJS service layer; how much
   overlap in transport-layer tests is acceptable?

The original GAS application was burned by mock/real divergence: adapter tests passed against
mocked repositories, but a production migration later failed because the mocks did not faithfully
represent the real store's behavior. That incident is a hard constraint on this decision.

---

## Decision

### 1. Test Pyramid and Tooling

```
packages/core         → Unit tests (Jest)        HIGH coverage target (≥90%)
apps/api adapters     → Integration tests (Jest + Testcontainers / real Sheets)
apps/api transport    → Integration tests (Jest + Supertest / graphql-request)
apps/web              → Component tests (Jest + React Testing Library)
apps/mobile           → Component tests (Jest + React Native Testing Library)
All packages          → E2E (Playwright — happy path only, low volume)
```

**Jest** is the single test runner across all workspaces. It is already configured at the
monorepo root. Each workspace extends the root config. Turborepo's `test` pipeline runs `jest`
per workspace.

**Playwright** is used for end-to-end tests only (see §E2E below). It is isolated to a
dedicated `apps/e2e/` workspace so it does not pollute core or api test runs.

### 2. Test File Location and Naming

All test files live alongside the code they test, not in a separate top-level `__tests__/`
directory:

```
packages/core/src/
  services/
    WorkoutService.ts
    WorkoutService.test.ts       # unit

apps/api/src/
  adapters/postgres/
    WorkoutRepository.ts
    WorkoutRepository.integration.test.ts   # integration
  transport/rest/
    WorkoutController.integration.test.ts   # transport integration
  transport/graphql/
    WorkoutResolver.integration.test.ts     # transport integration
```

Naming convention:
- `*.test.ts` — unit test (fast, no I/O)
- `*.integration.test.ts` — integration test (I/O required: database, HTTP, or Sheets API)

Jest `testMatch` patterns in each workspace config select the appropriate set. CI runs unit
tests on every push and integration tests on PR branches and main.

### 3. Repository Adapter Integration Tests — Real Stores Only

**No mocks or test doubles for repository adapters.** Adapter tests must run against real
infrastructure.

- **Postgres adapter:** Use [Testcontainers for Node.js](https://node.testcontainers.org/) to
  spin up a real Postgres instance in Docker during the test run. Migrations run against it
  before the test suite. Torn down after.
- **Google Sheets adapter:** Use a dedicated test Google Sheets spreadsheet (ID stored in
  `TEST_SHEETS_SPREADSHEET_ID` environment variable). Tests are skipped in environments where
  that variable is not set (e.g., local developer machines without service account credentials).

This is a direct response to the GAS burn: mocks do not expose type coercion bugs, missing index
behavior, transaction semantics, or Sheets quota/rate-limit behavior. Only a real store does.

**In-memory adapters** are implemented as a first-class workspace in `packages/core` (or
co-located with `packages/types`). They implement the same port interfaces as the Postgres and
Sheets adapters, but hold data in a plain JavaScript `Map`. They are used exclusively for:

- Unit tests of `packages/core` services (no I/O needed there)
- Rapid local development scaffolding before a real adapter is wired

In-memory adapters are **never used as a proxy for testing the real adapters.**

### 4. Dual-Transport Test Scope

REST and GraphQL share the same NestJS service layer. The test split is:

```
packages/core services  → Unit tests with in-memory adapters
                           Test: business logic, validation, error paths
                           Full coverage expected here.

apps/api REST            → Integration tests with Testcontainers Postgres
                           Test: HTTP status codes, response serialization,
                           auth middleware, request validation errors.
                           One test per endpoint; no business-logic re-testing.

apps/api GraphQL         → Integration tests with Testcontainers Postgres
                           Test: schema shape, query/mutation response structure,
                           auth middleware, resolver error handling.
                           One test per query/mutation; no business-logic re-testing.
```

**Deduplication rule:** Transport tests assert on transport concerns only (status codes,
headers, schema shape, serialization). They do not re-assert business rules already covered at
the service layer. When a bug is found in a business rule, the fix goes in `packages/core` with
a unit test there — not by adding a duplicate assertion to both transport test files.

### 5. E2E Tests

Playwright tests live in `apps/e2e/`. They run against a fully deployed staging environment, not
localhost. Scope is deliberately narrow:

- One happy-path test per major user flow (log a workout, view history, update config)
- No error-path or edge-case coverage — that belongs at the unit/integration layers
- Run in CI on merge to `main` only (not on every PR)

---

## Rationale

- **Real stores for adapter tests** is a direct lesson from the GAS incident. The cost of
  Testcontainers startup time is far lower than the cost of a broken migration discovered in
  production.
- **Co-located test files** keep tests easy to find and discourage the tendency to skip writing
  them when the test directory is far from the code.
- **Single runner (Jest)** avoids per-package tooling divergence and makes the Turborepo
  pipeline simple: `turbo run test` works uniformly.
- **Transport tests scope-limited to transport concerns** keeps the test suite from exploding as
  the dual-transport surface grows. Every new endpoint needs two transport tests (REST + GraphQL),
  not four (two × business logic).
- **In-memory adapters as first-class implementations** (not anonymous stubs) means they are
  maintained with the same care as real adapters and serve as executable documentation of each
  port interface.

---

## Consequences

- Testcontainers requires Docker to be available in CI. The CI pipeline must include a Docker
  daemon. GKE and GitHub Actions both satisfy this; local environments without Docker cannot run
  integration tests (they can run unit tests only).
- The `TEST_SHEETS_SPREADSHEET_ID` secret must be provisioned in CI for Sheets adapter tests to
  run. Sheets adapter tests are skipped in environments without the secret, creating a CI
  coverage gap until credentials are provisioned.
- In-memory adapters add implementation surface area. They must be kept in sync with the port
  interfaces. A breaking port change requires updating both in-memory and real adapters.
- Playwright tests against staging require a stable staging environment before E2E coverage is
  meaningful. E2E tests are deferred to v0.2 when the first deployed endpoint exists.

---

## Alternatives Considered

**Mock repositories for all adapter tests:** Fastest to write, zero infrastructure dependency.
Rejected because the GAS incident demonstrated that mock/real divergence is a realistic failure
mode in this codebase, not a theoretical one.

**Shared test database (not Testcontainers):** A persistent shared Postgres instance avoids
Docker startup cost. Rejected because shared state between test runs causes flaky, order-dependent
tests. Per-run containers eliminate that class of failure.

**Single integration test suite for REST and GraphQL together:** Simpler file structure.
Rejected because it couples transport-layer concerns and makes it harder to identify whether a
failure is in the REST serialization path, the GraphQL schema, or the shared service layer.

**Vitest instead of Jest:** Faster native ESM support. Deferred — the monorepo already has Jest
configured; switching at this stage would require coordinated config changes across all
workspaces. Can be revisited in v0.3 once the test suite has real coverage to validate against.
