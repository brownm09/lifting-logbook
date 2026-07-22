# ADR-010: Multi-Tenancy Data Isolation Strategy

**Status:** Accepted
**Date:** 2026-04-03
**Reviewed:** 2026-04-07
**Review outcome:** Pass
**Implementation status (2026-06-11):** Implemented — isolation is now **two-layer**. Application-level `user_id` scoping remains in every repository, and the Postgres **RLS defense-in-depth layer is now live**: migration `20260611000000_enable_rls` enables + forces RLS and creates per-user `CREATE POLICY` rules on all 14 user-data tables, and a per-request NestJS interceptor sets `app.current_user_id` (via `set_config`) inside a transaction that every repository query runs through. The gap was surfaced by the 2026-06-08 architecture review ([#464](https://github.com/merickvaughn/lifting-logbook/issues/464)) and closed in [#511](https://github.com/merickvaughn/lifting-logbook/issues/511). See the **Implementation** section below for the mechanism and the superuser/role requirement.

**Correction (2026-07-02):** The RLS layer described above was **not actually live** from 2026-06-11 until [#645](https://github.com/merickvaughn/lifting-logbook/pull/645) merged. `rls.interceptor.ts` constructor-injected `PrismaService` as an `@Optional()` dependency; because it is bound globally via `APP_INTERCEPTOR`, NestJS instantiated it before `PrismaService`'s factory provider (declared in the same module) was guaranteed to have run, so the injection silently resolved to `null` and stayed `null` for the interceptor's lifetime. The `app.current_user_id` GUC was therefore never set on any request. Application-level `user_id` scoping (the first layer) was unaffected the entire time, so this was a missing second layer, not a cross-tenant data leak — see [#644](https://github.com/merickvaughn/lifting-logbook/issues/644) for the full incident writeup. The **Verification** bullet below, which claimed the existing test suite "proves... the interceptor wires the GUC end to end," was also inaccurate: that suite connects as the bootstrap superuser, which bypasses RLS by Postgres design, so it could not have caught this. #645 fixes the interceptor (resolves `PrismaService` lazily via `ModuleRef` instead of at construction) and adds test coverage that boots the real app under the restricted `lifting_app` role — the combination the original verification was missing.

**Follow-up (2026-07-03):** #645 fixed *why* `PrismaService` could resolve to `null`, but the interceptor's fallback guard still treated "null and no DB expected" (legitimate in-memory/SystemDb mode) and "null but a real DB connection is configured" (broken plumbing — the exact #644 failure mode) identically: both silently ran the request with no GUC set. [#649](https://github.com/merickvaughn/lifting-logbook/issues/649) closed that gap — the interceptor now checks `DATABASE_URL` in addition to the Prisma-client-null check, and throws `InternalServerErrorException` instead of silently proceeding when a real DB connection is expected but the client is unavailable. This makes a future recurrence of the #644 failure mode surface immediately as a 500 rather than as silent fail-closed reads/writes indistinguishable from "no data yet."

---

## Context

The cloud-native version supports multiple users, each with private workout data. The question of
how to isolate that data has meaningful implications for security, compliance, operational
complexity, and cost. Three strategies are commonly used in multi-tenant SaaS applications:

1. **Shared schema** — all tenants' data in shared tables, distinguished by a `user_id` column
2. **Schema-per-tenant** — each tenant gets their own Postgres schema (namespace) within a
   shared database instance
3. **Database-per-tenant** — each tenant gets a dedicated database instance

This decision is documented with all three strategies described, because compliance requirements
are a significant factor in the professional context in which this application is presented.

---

## Decision

Use **shared schema with `user_id` scoping** for the Postgres adapter.

Every user-data table includes a `userId TEXT NOT NULL` column (`custom_program_spec` is the one
exception — it has no `userId` and is isolated through its parent program's FK). All queries are
filtered by the authenticated user's ID. Row-Level Security (RLS) is enabled in Postgres as a
defense-in-depth measure, with **fail-closed** semantics (an unset session variable resolves to
`NULL`, which matches no rows):

```sql
ALTER TABLE "training_max" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "training_max" FORCE ROW LEVEL SECURITY;

CREATE POLICY "training_max_user_isolation" ON "training_max"
  USING ("userId" = current_setting('app.current_user_id', true))
  WITH CHECK ("userId" = current_setting('app.current_user_id', true));
```

The application sets `app.current_user_id` once per request (via `set_config(_, _, true)`, the
transaction-local `SET LOCAL` form) inside a transaction that every repository query for that
request runs through, so RLS enforcement happens at the database level independent of application
logic. See **Implementation** for why this requires a non-superuser database role.

---

## Implementation

Implemented in [#511](https://github.com/merickvaughn/lifting-logbook/issues/511) (2026-06-11).

- **Policies** — migration `apps/api/prisma/migrations/20260611000000_enable_rls` runs `ENABLE` +
  `FORCE ROW LEVEL SECURITY` and one `USING`/`WITH CHECK` policy per table on all 13 `userId`
  tables, plus an `EXISTS`-subquery policy on `custom_program_spec` (no `userId` — isolated through
  `custom_program."userId"`). `FORCE` so the table owner is also constrained.
- **Per-request user context** — `apps/api/src/adapters/prisma/rls.interceptor.ts` is a global
  NestJS interceptor that, for every authenticated HTTP request, opens one interactive transaction,
  runs `SELECT set_config('app.current_user_id', $userId, true)`, and stores the transaction client
  in CLS (`nestjs-cls`). `PrismaRepositoryFactory` routes every repository through that client, so
  all of a request's queries see the GUC. The `set_config` is wrapped in a manual OpenTelemetry
  span ([ADR-024](ADR-024-prisma-otel-sdk-override.md) — raw SQL is not auto-traced). Because the
  GUC is transaction-local, all of a request's DB work shares one transaction; the two repositories
  that batch writes and the one that runs an interactive transaction use a small helper
  (`prisma-tx.util.ts`) that reuses the request transaction instead of nesting (Prisma's
  transaction client cannot open a nested transaction). The interceptor no-ops (runs the request on
  the base client, no GUC) only when `DATABASE_URL` is unset — the legitimate in-memory/SystemDb
  case. If `DATABASE_URL` **is** set but the Prisma client still can't be resolved, it throws
  `InternalServerErrorException` instead of silently no-op'ing, so a recurrence of the #644 failure
  mode (broken DI plumbing masquerading as "no data yet") surfaces immediately ([#649](https://github.com/merickvaughn/lifting-logbook/issues/649)).
- **Non-superuser role (required for enforcement)** — RLS is ignored by superusers and `BYPASSRLS`
  roles. The migration creates a `lifting_app` role (`NOSUPERUSER NOBYPASSRLS`); the application
  must connect as it in deployed environments for the policies to bite. Migrations run as the
  owner/superuser role. Local dev and CI connect as the bootstrap superuser, so RLS is **dormant**
  there (the app still works via the per-query `userId` scoping) — which is also the
  instant-rollback path: repoint `DATABASE_URL` at the superuser role and RLS goes dormant with no
  schema change. Provisioning `lifting_app` on Cloud SQL (Terraform user + secret cutover) is a
  deployment-coupled follow-up.
- **Verification** — `apps/api/src/adapters/prisma/rls.db.e2e.spec.ts` connects *as* `lifting_app`
  and proves unscoped-read isolation, fail-closed-on-unset-GUC, `WITH CHECK` rejection, the
  `custom_program_spec` FK policy, and that the test role is genuinely non-superuser/non-`BYPASSRLS`.
  Its "RLS request wiring (interceptor + factory, full app boot)" block (added in
  [#645](https://github.com/merickvaughn/lifting-logbook/pull/645)) additionally boots the real
  `AppModule` under the restricted role and proves the interceptor wires the GUC end to end for a
  genuine request — the combination the original verification (raw Prisma calls, or a manually
  constructed interceptor bypassing Nest's real DI resolution) did not cover, and the gap that let
  the interceptor sit inert for three weeks (see the 2026-07-02 correction above).
- **Per-operation user context (`@SkipRlsTransaction()`)** — `cycle-plan` calls an LLM between DB
  reads. Holding one request-level transaction across the model call would pin a DB connection for
  its full duration, so that handler opts out via `@SkipRlsTransaction()`
  ([#518](https://github.com/merickvaughn/lifting-logbook/issues/518)). The interceptor then stores only
  the userId in CLS (`RLS_USER_ID_KEY`) without opening a transaction; the handler wraps each unit
  of DB work in `RlsContextService.withUserContext` (`rls-context.service.ts`), which opens a
  short-lived (5 s) transaction, sets the GUC, and **builds the repositories inside that
  transaction** so they bind to the RLS-scoped client. The LLM round-trips happen outside any
  transaction, so a connection is held only for the brief span of each DB operation. The
  short-transaction `set_config` is wrapped in the same manual OpenTelemetry span as the
  per-request path.

---

## Rationale

- **Operational simplicity:** One schema, one set of migration scripts, one connection pool.
  Adding a new user requires no schema or database provisioning.
- **Cost efficiency:** A single Postgres instance (Cloud SQL) serves all users. No per-user
  provisioning overhead.
- **Appropriate for the use case:** This application handles personal fitness data. It is not
  currently subject to HIPAA, GDPR data sovereignty requirements, or enterprise data isolation
  contractual obligations. Shared schema is the industry-standard choice for this compliance
  profile.
- **Defense-in-depth via RLS:** Postgres Row-Level Security provides a database-enforced
  isolation layer that protects against application bugs that might otherwise leak cross-user
  data. This is a material security improvement over application-only scoping.

---

## Compliance Analysis: When This Decision Would Change

### GDPR — Right to Erasure (Article 17)

**Shared schema:** Erasure requires a `DELETE WHERE user_id = :id` across all user-data tables.
With a well-maintained schema this is straightforward, but requires careful enumeration of all
tables. Soft-delete patterns (marking rows as deleted, purging asynchronously) are common.

**Schema-per-tenant:** Erasure is `DROP SCHEMA user_<id> CASCADE`. Atomic, complete, and
requires no enumeration of tables. Significantly simpler to audit and certify.

**Recommendation:** If GDPR right-to-erasure compliance were a hard requirement (e.g., if this
were a consumer product marketed to EU users), schema-per-tenant would be the minimum
recommended approach due to the simplicity and auditability of erasure.

### HIPAA — Protected Health Information

Fitness data is **not PHI** under HIPAA unless collected in the context of a covered entity
(e.g., a healthcare provider's clinical system). A standalone fitness tracking app does not
trigger HIPAA.

If this application were modified to integrate with clinical workflows or to be deployed by a
covered entity, the following would apply:

**Shared schema:** Does not provide sufficient isolation for a covered entity without additional
controls (field-level encryption, comprehensive audit logging, dedicated infrastructure). A
Business Associate Agreement (BAA) with the cloud provider would be required. Signing a BAA
while storing PHI in a shared table is technically possible but operationally fragile.

**Database-per-tenant:** The preferred architecture for HIPAA-covered entities. Each tenant's
PHI is in a dedicated, independently-auditable database instance. Encryption keys are per-tenant
(KMS with per-tenant key hierarchy). Breach impact is bounded to a single tenant's data.
Compliance audit scope is cleaner.

**Recommendation:** For a HIPAA-covered deployment, database-per-tenant with per-tenant
encryption keys would be required. This would be implemented via the `IRepositoryFactory`
pattern ([ADR-003](ADR-003-per-user-data-store-config.md)) — the factory would provision and return a connection to the tenant-specific
database. The core domain logic would be entirely unchanged.

### SOC 2 Type II — Data Isolation Controls

A SOC 2 audit for a shared-schema application requires demonstrating that logical isolation
controls (application-level scoping + RLS) are equivalent to physical isolation. This is
achievable but requires comprehensive audit logging (who accessed which user's data, when) and
penetration testing of the isolation boundary.

Schema-per-tenant or database-per-tenant architectures are easier to certify for SOC 2 data
isolation controls because the isolation is architectural rather than logical.

---

## Implementation Note: Shared Schema → Schema-Per-Tenant Migration Path

If compliance requirements change, the migration from shared schema to schema-per-tenant is
well-defined:

1. For each existing user: `CREATE SCHEMA user_<id>; CREATE TABLE user_<id>.workouts AS SELECT * FROM public.workouts WHERE user_id = '<id>';` (and so on for each table)
2. Update `IRepositoryFactory` to set `search_path` to the user's schema on connection
3. Drop the `user_id` columns from the per-schema tables (no longer needed)
4. Truncate / drop the shared tables after validation

This migration is bounded by the `IRepositoryFactory` abstraction: no changes to core services
or domain logic.

---

## Alternatives Considered

**Schema-per-tenant:** Better GDPR erasure story, stronger isolation boundary. Drawbacks:
schema migrations must fan out to all tenant schemas (requires a migration orchestration layer,
e.g., iterating schemas and applying `ALTER TABLE` to each). Connection pooling (PgBouncer)
requires `search_path` management. Operationally more complex. Appropriate if GDPR right-to-
erasure is a hard requirement.

**Database-per-tenant:** Maximum isolation. Required for HIPAA-covered entities. Operationally
expensive: each tenant requires a Cloud SQL instance (~$7–15/month minimum), making this
prohibitively costly for a consumer product. Appropriate only for B2B SaaS with enterprise
pricing that absorbs the infrastructure cost, or for HIPAA/regulated data.

---

## References

- [PostgreSQL — Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html) — The RLS feature used for database-level isolation; documents `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, `FORCE ROW LEVEL SECURITY`, `CREATE POLICY` syntax, and the superuser/`BYPASSRLS` exemption that requires connecting as a non-superuser role.
- [PostgreSQL — Configuration Settings Functions (`set_config` / `current_setting`)](https://www.postgresql.org/docs/current/functions-admin.html#FUNCTIONS-ADMIN-SET) — How `app.current_user_id` is set transaction-locally (`set_config(_, _, true)`) and read in policies (`current_setting('app.current_user_id', true)`, with `missing_ok = true` for fail-closed behaviour).
- [nestjs-cls](https://papooch.github.io/nestjs-cls/) — The AsyncLocalStorage-backed CLS library used to carry the per-request transaction client from the RLS interceptor down to the repository factory.
- [PostgreSQL — Schemas](https://www.postgresql.org/docs/current/ddl-schemas.html) — The schema-per-tenant alternative; covers `CREATE SCHEMA`, `search_path`, and namespace isolation.
- [GDPR — Article 17: Right to Erasure](https://gdpr-info.eu/art-17-gdpr/) — The regulatory requirement analysed in the Compliance Analysis section; the difference in erasure complexity between shared-schema and schema-per-tenant is documented relative to this article.
- [HHS — HIPAA Security Rule](https://www.hhs.gov/hipaa/for-professionals/security/index.html) — The US healthcare data protection regulation discussed in the HIPAA section; relevant if the application is extended to clinical contexts.
- [PgBouncer — Usage](https://www.pgbouncer.org/usage.html) — The connection pooler cited in the schema-per-tenant alternative discussion (`search_path` management requirement).
