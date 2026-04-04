# ADR-010: Multi-Tenancy Data Isolation Strategy

**Status:** Accepted
**Date:** 2026-04-03

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

Every user-data table includes a `user_id TEXT NOT NULL` column. All queries are filtered by the
authenticated user's ID. Row-Level Security (RLS) is enabled in Postgres as a defense-in-depth
measure:

```sql
-- Enable RLS on all user-data tables
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;

-- Policy: users can only see their own rows
CREATE POLICY user_isolation ON workouts
  USING (user_id = current_setting('app.current_user_id'));
```

The application sets `app.current_user_id` at the start of each database session via Prisma
middleware, so RLS enforcement happens at the database level independent of application logic.

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
