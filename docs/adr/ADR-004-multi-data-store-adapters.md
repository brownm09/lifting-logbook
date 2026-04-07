# ADR-004: Multi-Data-Store Adapter Strategy (Sheets and Postgres)

**Status:** Accepted
**Date:** 2026-04-03
**Reviewed:** 2026-04-07
**Review outcome:** Pass

---

## Context

The application must persist and retrieve workout data from at least two backends: Google Sheets
(to preserve compatibility with the original GAS version) and PostgreSQL (as the primary
cloud-native store for new users). Additional stores may be introduced in the future.

---

## Decision

Implement each data store as a separate **adapter** conforming to the port interfaces defined in
[ADR-002](ADR-002-ports-and-adapters.md). Two adapters will be built:

1. **`SheetsRepositoryBundle`** — reads and writes data using the Google Sheets API (v4) via
   the `googleapis` npm package. Each repository maps between domain models and spreadsheet
   ranges, reusing the parser/mapper logic from `packages/core`.

2. **`PostgresRepositoryBundle`** — reads and writes data using a relational schema. Uses
   Prisma as the ORM for type-safe queries and schema migrations.

Both bundles implement `IRepositoryFactory` and are selected at request time per [ADR-003](ADR-003-per-user-data-store-config.md).

### Postgres Schema (initial)

```sql
-- Core entities, all scoped by user_id
CREATE TABLE training_maxes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT NOT NULL,
  lift       TEXT NOT NULL,
  weight     NUMERIC NOT NULL,
  unit       TEXT NOT NULL DEFAULT 'lbs',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE workouts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT NOT NULL,
  week       INT NOT NULL,
  cycle      INT NOT NULL,
  lift       TEXT NOT NULL,
  scheduled_date DATE,
  completed_at   TIMESTAMPTZ
);

CREATE TABLE lift_records (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL,
  workout_id  UUID REFERENCES workouts(id),
  set_number  INT NOT NULL,
  reps        INT NOT NULL,
  weight      NUMERIC NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Additional tables follow the same pattern
```

---

## Rationale

- **Reuses existing parsers/mappers:** The Sheets adapter can directly use the parser and mapper
  functions already written in `packages/core`, which already handle the spreadsheet-to-domain
  mapping. The migration cost from the GAS version is low.
- **Prisma for Postgres:** Prisma provides TypeScript-native query building, auto-generated
  types from the schema, and a migration system. It is well-supported in both Node.js and
  serverless/containerized environments.
- **No ORM for Sheets:** The Sheets adapter is necessarily custom — there is no meaningful ORM
  for spreadsheet data. The existing mapper/parser layer serves this purpose.

---

## Consequences

- Sheets adapter performance is bounded by the Google Sheets API quota (100 requests/100 seconds
  per user by default). This is acceptable for personal use but would require quota increase for
  multi-user production workloads.
- Postgres adapter requires a running Postgres instance (managed via Cloud SQL on GCP, or a
  sidecar in Kubernetes). See [ADR-009](ADR-009-infrastructure-kubernetes-cloud-run.md) for infrastructure choices.
- Adding a third data store (e.g., Firestore, DynamoDB) is bounded: implement the port
  interfaces, register the adapter. Domain logic is unaffected.

---

## Alternatives Considered

**Firestore as the primary cloud-native store:** Serverless, no schema management, scales
automatically. However, it is a document store and the domain model is inherently relational
(workouts have sets, programs have weeks, maxes have history). Mapping a relational model onto
Firestore introduces query complexity that Postgres handles naturally. Postgres also has stronger
portfolio signal for a director of engineering role.

**Prisma for both Sheets and Postgres:** Not feasible — Prisma is a relational database ORM and
has no Sheets adapter.

---

## References

- [Google Sheets API v4 — Reference](https://developers.google.com/sheets/api/reference/rest) — The API used by the Sheets adapter for reads and writes; documents range notation, batch operations, and value rendering modes.
- [Google Sheets API — Usage Limits](https://developers.google.com/sheets/api/limits) — Documents the 100 requests/100 seconds per-user quota cited in the Consequences section.
- [googleapis npm package](https://www.npmjs.com/package/googleapis) — The Node.js client library wrapping the Sheets API.
- [Prisma ORM — Getting Started](https://www.prisma.io/docs/getting-started) — The ORM used for the Postgres adapter; provides schema definition, type-safe query building, and migrations.
- [Prisma Migrate](https://www.prisma.io/docs/orm/prisma-migrate/getting-started) — The migration system used for evolving the Postgres schema.
