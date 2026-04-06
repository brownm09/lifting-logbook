# ADR-003: Per-User Data Store Configuration

**Status:** Accepted
**Date:** 2026-04-03

---

## Context

The system must support multiple data store backends (Google Sheets, Postgres). Different users
may be on different backends — for example, a user who already has a Sheets-based logbook may
onboard without migrating their data, while new users are provisioned directly in Postgres.

The question is whether the adapter is chosen at deployment time (one adapter per running
instance) or at request time (resolved per authenticated user).

---

## Decision

Resolve the data store adapter **per user, per request**, based on the authenticated user's
stored configuration.

A `user_data_source` table (in a system-level Postgres database, separate from user data)
stores the adapter type and adapter-specific configuration for each user:

```sql
CREATE TABLE user_data_source (
  user_id       TEXT PRIMARY KEY,
  adapter_type  TEXT NOT NULL,           -- 'sheets' | 'postgres'
  adapter_config JSONB NOT NULL          -- adapter-specific: spreadsheet_id, credentials, etc.
);
```

A **repository factory** is injected into request handlers. It reads the user's config and
returns the appropriate adapter implementation:

```typescript
interface IRepositoryFactory {
  forUser(user: AuthUser): RepositoryBundle;
}

interface RepositoryBundle {
  workouts: IWorkoutRepository;
  trainingMaxes: ITrainingMaxRepository;
  cycleDashboard: ICycleDashboardRepository;
  liftingProgramSpec: ILiftingProgramSpecRepository;
  liftRecords: ILiftRecordRepository;
}
```

---

## Rationale

- **Gradual migration:** Users can be migrated from Sheets to Postgres individually without a
  flag-day cutover. This is operationally safer and provides a natural rollback path.
- **Onboarding flexibility:** New users can be provisioned in Postgres immediately. Existing
  Sheets users can be onboarded without disruption.
- **Demonstrates runtime polymorphism:** The pattern is more architecturally interesting than
  per-deployment config, and demonstrates a real problem that multi-tenant SaaS platforms face.
- **Adapter configs differ in shape:** Sheets adapters need a spreadsheet ID and service account
  credentials; Postgres adapters only need a `user_id` for row scoping. The `adapter_config`
  JSONB column handles both without a separate table per adapter type.

---

## Consequences

- The factory performs a DB lookup on every request unless the result is cached. A short-lived
  in-memory or Redis cache (keyed by `user_id`, TTL ~5 minutes) is sufficient to make this
  negligible in practice.
- `adapter_config` for Sheets contains sensitive credentials (service account keys or OAuth
  tokens). This column must be encrypted at rest (Postgres column-level encryption or KMS-backed
  envelope encryption).
- Adapter config changes (e.g., a user migrates to Postgres) take effect after the cache TTL,
  which is acceptable.

---

## Alternatives Considered

**Per-deployment config (one adapter for all users):** Simpler DI wiring; adapter is set once at
startup. Does not support mixed-adapter user populations. Ruled out because the ability to
onboard Sheets users without immediate data migration is a functional requirement.

**Per-feature-flag config:** Use a feature flag system (e.g., LaunchDarkly) to route users.
Adds a third-party dependency for what is essentially a data routing decision. Overkill at this
stage, though a feature flag layer could be added on top of this approach later for canary
migrations.

---

## References

- [PostgreSQL — JSON Types (JSONB)](https://www.postgresql.org/docs/current/datatype-json.html) — Documents the `JSONB` column type used for `adapter_config`; covers indexing, operators, and storage behaviour.
- [Google Cloud KMS — Envelope Encryption](https://cloud.google.com/kms/docs/envelope-encryption) — The encryption strategy recommended for the `adapter_config` column, which stores sensitive Sheets OAuth tokens and service account credentials.
- [Prisma Client — Middleware](https://www.prisma.io/docs/orm/prisma-client/client-extensions/middleware) — How Prisma middleware is used to enforce the per-user cache lookup and inject `app.current_user_id` before each query.
