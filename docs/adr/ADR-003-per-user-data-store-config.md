# ADR-003: Per-User Data Store Configuration

**Status:** Accepted
**Date:** 2026-04-03
**Reviewed:** 2026-04-07
**Review outcome:** Pass with gaps — open items resolved: [#38](https://github.com/brownm09/lifting-logbook/issues/38) (ADR-014), [#39](https://github.com/brownm09/lifting-logbook/issues/39) (cache invalidation section below)

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

## Cache Invalidation

The factory caches the resolved adapter config in memory, keyed by `user_id`, with a TTL of
approximately 5 minutes. This section documents when and how that cache is invalidated.

### Normal expiry

Cache entries expire automatically after the TTL. Config changes (e.g., migrating a user from
the Sheets adapter to Postgres) take effect within 5 minutes without any operator action. This
is the expected path for planned migrations.

### Admin-triggered immediate invalidation

For cases where immediate effect is required — for example, an in-progress migration where
serving the wrong adapter would corrupt data, or an emergency key revocation (see
[ADR-014 — Cache Interaction](ADR-014-credential-encryption-at-rest.md#cache-interaction)) —
an admin can force cache eviction before the TTL expires.

Two mechanisms are supported depending on the cache backend:

**In-process cache (single instance):**
`POST /admin/users/:userId/invalidate-cache` — a protected admin endpoint that calls
`cache.delete(userId)` directly. Requires the `admin:cache` scope on the caller's JWT.

**Distributed cache (Redis, multi-instance):**
`DEL lifting-logbook:factory-cache:<userId>` — executed against the Redis instance via the
`redis-cli` or an admin script. This is the only mechanism that works when multiple API
replicas share a Redis cache, because the HTTP endpoint only invalidates the local instance.

### What the user observes during migration

After a user's `adapter_type` is changed in `user_data_source` but before the cache entry
expires or is evicted:
- Requests continue to be served by the old adapter (Sheets or Postgres) as configured in
  the cached entry.
- No error is surfaced to the user; the old adapter responds normally.
- Once the cache entry expires or is evicted, the next request re-reads `user_data_source`
  and routes to the new adapter.

For migrations involving data that must not be double-written, the sequence is:
1. Pause writes (application-level or by taking the user offline temporarily).
2. Migrate data.
3. Update `user_data_source` to the new `adapter_type`.
4. Trigger immediate cache invalidation via the admin endpoint or Redis `DEL`.
5. Resume writes.

### Detecting stale cache

Each factory resolve emits a structured log line with the following fields:

```json
{
  "event": "factory.resolve",
  "userId": "<user_id>",
  "adapterType": "sheets|postgres",
  "cacheHit": true,
  "ttlRemainingMs": 240000
}
```

A `cacheHit: true` entry with an `adapterType` that does not match the current
`user_data_source` row indicates a stale cache entry. To detect during or after a migration:
1. Query `user_data_source` for the user's expected `adapter_type` after the update.
2. Search structured logs for `factory.resolve` events with `cacheHit: true` and an
   `adapterType` that does not match the expected value within the migration window.

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
