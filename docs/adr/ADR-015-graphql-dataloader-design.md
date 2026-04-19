# ADR-015: GraphQL DataLoader Design — Scope, Batching, and Request Isolation

**Status:** Accepted
**Date:** 2026-04-09
**Closes:** [#40](https://github.com/brownm09/lifting-logbook/issues/40)

---

## Context

[ADR-006](ADR-006-rest-and-graphql-dual-transport.md) identifies the N+1 problem in nested
GraphQL resolvers and names `graphql/dataloader` as the solution. Two design questions were
left open:

1. **Lifecycle:** Should DataLoader instances be module-scoped (NestJS singletons) or
   request-scoped (new instance per request)?
2. **Batching strategy:** What are the batching key shapes for each entity, and how do
   DataLoaders interact with the per-request adapter resolution from ADR-003?

Getting the lifecycle wrong is a security defect, not merely a correctness issue. This ADR
documents the required design before any GraphQL resolvers are implemented.

---

## Decision

### 1. Lifecycle: Request-scoped NestJS providers

DataLoader instances **must** be created fresh for every incoming HTTP request. In NestJS,
this is enforced by registering the DataLoader service with `Scope.REQUEST`:

```typescript
// Illustrative — types not yet defined in @logbook/core:
//   RepositoryBundle: object returned by IRepositoryFactory.forUser(), grouping
//     per-entity repository instances (workouts, liftRecords, trainingMaxes, …)
//   Workout, LiftRecord, TrainingMax: domain types from packages/types
// These will be concrete once port interface scaffolding (issue #71 area) ships.

import { Injectable, Scope, Inject } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import DataLoader from 'dataloader';
import { IRepositoryFactory, RepositoryBundle } from '@logbook/core';
import { RequestWithUser } from '../auth/request-with-user.interface';

@Injectable({ scope: Scope.REQUEST })
export class DataLoaderService {
  private readonly repos: RepositoryBundle;

  readonly workoutLoader: DataLoader<string, Workout>;
  readonly liftRecordsByWorkoutLoader: DataLoader<string, LiftRecord[]>;
  readonly trainingMaxesLoader: DataLoader<string, TrainingMax[]>;

  constructor(
    @Inject(REQUEST) request: RequestWithUser,
    repositoryFactory: IRepositoryFactory,
  ) {
    this.repos = repositoryFactory.forUser(request.user);

    // Arrow function class fields capture `this` lexically — no .bind() needed.
    this.workoutLoader = new DataLoader(this._batchWorkouts);
    this.liftRecordsByWorkoutLoader = new DataLoader(this._batchLiftRecordsByWorkout);
    this.trainingMaxesLoader = new DataLoader(this._batchTrainingMaxes);
  }

  // Returns Error for a missing id: a workout that cannot be resolved by id is
  // a data-integrity problem, not a normal empty-result case.
  private readonly _batchWorkouts = async (ids: readonly string[]): Promise<(Workout | Error)[]> => {
    const workouts = await this.repos.workouts.findByIds([...ids]);
    const map = new Map(workouts.map(w => [w.id, w]));
    return ids.map(id => map.get(id) ?? new Error(`Workout not found: ${id}`));
  };

  // Returns [] for a workoutId with no records: zero lift records is a valid
  // state (new or empty workout), not an error.
  private readonly _batchLiftRecordsByWorkout = async (workoutIds: readonly string[]): Promise<(LiftRecord[] | Error)[]> => {
    const records = await this.repos.liftRecords.findByWorkoutIds([...workoutIds]);
    const grouped = new Map<string, LiftRecord[]>();
    for (const r of records) {
      const bucket = grouped.get(r.workoutId) ?? [];
      bucket.push(r);
      grouped.set(r.workoutId, bucket);
    }
    return workoutIds.map(id => grouped.get(id) ?? []);
  };

  // Within a request there is exactly one authenticated user, so this loader
  // always receives a single-element key array. The batch signature is retained
  // so that resolvers interact with DataLoaderService uniformly (always via
  // .load(), never via direct repository calls).
  private readonly _batchTrainingMaxes = async (userIds: readonly string[]): Promise<(TrainingMax[] | Error)[]> => {
    const maxes = await this.repos.trainingMaxes.findForUsers([...userIds]);
    const grouped = new Map<string, TrainingMax[]>();
    for (const m of maxes) {
      const bucket = grouped.get(m.userId) ?? [];
      bucket.push(m);
      grouped.set(m.userId, bucket);
    }
    return userIds.map(id => grouped.get(id) ?? []);
  };
}
```

`DataLoaderService` is injected into each NestJS resolver that needs batching. Because
`Scope.REQUEST` propagates up the dependency tree, the resolver itself is also request-scoped.

### 2. Batching key strategy per entity

| Entity | Key | Batch function source | Missing-key result | Notes |
|---|---|---|---|---|
| `Workout` | `workoutId: string` | `IWorkoutRepository.findByIds(ids)` | `Error` — unresolvable workout ID is a data-integrity problem | Used when resolving `liftRecords` or `sets` fields on a list of workouts |
| `LiftRecord` (by workout) | `workoutId: string` | `ILiftRecordRepository.findByWorkoutIds(ids)` | `[]` — zero records is a valid state for a new or empty workout | Returns `LiftRecord[]` per key |
| `TrainingMax` (by user) | `userId: string` | `ITrainingMaxRepository.findForUsers(ids)` | `[]` — user with no training maxes is valid | Single user per request in practice; batch form retained so all resolvers interact with `DataLoaderService` uniformly via `.load()` rather than calling repositories directly |

Keys are always plain strings (entity IDs or the authenticated user's ID). Compound keys
(e.g., `cycleId + weekId`) are serialised to a delimited string if needed and deserialised
inside the batch function.

### 3. Interaction with ADR-003 adapter resolution

ADR-003 resolves the correct repository adapter per authenticated user per request. The
`DataLoaderService` receives this adapter bundle in its constructor, so every batch function
calls the correct user-scoped repository. There is no shared state between requests:

```
Request A (User 1, Sheets adapter) ──► DataLoaderService instance A ──► Sheets repos
Request B (User 2, Postgres adapter) ──► DataLoaderService instance B ──► Postgres repos
```

The DataLoader cache lives entirely within an instance. When the request completes and the
NestJS request scope is destroyed, the instance and its cache are garbage-collected.

---

## Rationale

### Why request scope is mandatory (the data-leakage risk)

A NestJS singleton-scoped DataLoader would persist its cache across requests. Consider this
sequence:

1. Request from **User A** loads `workout:42` → result cached: `{ id: '42', userId: 'A', … }`
2. Request from **User B** asks for `workout:42` → DataLoader cache hit → **returns User A's data**

This is a cross-user data leak. Row-Level Security (ADR-010) would prevent the underlying
database query from returning the wrong row, but the cache bypass means the database is
never consulted. RLS cannot protect against a stale in-memory cache.

The same failure mode applies to the Sheets adapter, where there is no RLS at all — the
only isolation is at the application layer, making a singleton DataLoader especially
dangerous.

**A singleton DataLoader is a security defect, not a performance trade-off.**

### Why NestJS `Scope.REQUEST` over manual factory instantiation

An alternative is to instantiate DataLoaders manually inside each resolver method. This
avoids the NestJS request scope mechanism but creates two problems:

1. DataLoaders created inside a resolver method do not share a batch queue with other
   resolvers in the same request, defeating the purpose of batching across field resolvers.
2. Manual instantiation scatters lifecycle management across the resolver layer.

`Scope.REQUEST` on a single `DataLoaderService` creates one set of DataLoader instances per
request, shared by all resolvers that receive the service via injection. Batching works
correctly across all resolver calls within the same request.

### Why per-entity DataLoaders rather than a generic loader

A single generic `DataLoader<{ entity: string; id: string }, unknown>` is tempting but
makes the batch function responsible for routing to multiple repositories, which obscures
what each batch call actually fetches. Per-entity loaders keep batch functions narrow and
repository calls explicit.

---

## Consequences

- All NestJS resolvers that use `DataLoaderService` inherit `Scope.REQUEST`. NestJS
  propagates the scope upward automatically; no manual annotation is needed on resolvers.
- Request-scoped providers have a small instantiation cost per request (constructor runs
  once per request rather than once at startup). For this application the cost is negligible
  — three `new DataLoader(...)` calls and one `repositoryFactory.forUser()` lookup, which
  ADR-003 notes is cheap with the in-memory cache in place.
- The DataLoader cache is per-request only. There is no cross-request caching of entity
  data. This is intentional: stale cross-request cache is the defect being prevented.
- Adding a new entity that requires batching means adding a new loader property and batch
  method to `DataLoaderService`. The pattern is mechanical and testable in isolation.

---

## Alternatives Considered

**Singleton DataLoader with manual cache invalidation:** Cache hits would be invalidated
by calling `loader.clear(key)` or `loader.clearAll()` at the start of each request. This
is error-prone — any missed invalidation is a latent data-leak bug. Ruled out because the
failure mode is silent and security-relevant.

**Context-based DataLoader (passing loaders via GraphQL context):** Some NestJS + GraphQL
setups pass DataLoader instances through the GraphQL execution context object. This is
functionally equivalent to `Scope.REQUEST` injection, but the context approach bypasses
NestJS's DI container, losing testability (no easy mock injection) and type safety. Ruled
out in favour of the idiomatic NestJS DI approach.

**No DataLoader (accept N+1):** Acceptable for a read-mostly API with a small dataset and
no concurrent users. Not acceptable here because the Sheets adapter has a strict rate limit
(100 requests/100 seconds per user, per ADR-004), making N+1 resolver calls a functional
correctness issue, not just a performance concern.

---

## References

- [graphql/dataloader — README](https://github.com/graphql/dataloader#readme) — The batching and caching library; documents the batch function contract, cache behaviour, and the per-request instantiation pattern (see "Creating a new DataLoader per request" section).
- [NestJS — Injection Scopes](https://docs.nestjs.com/fundamentals/injection-scopes) — Documents `Scope.REQUEST`, scope propagation up the dependency tree, and the performance implications of request-scoped providers; the NestJS mechanism used to enforce per-request DataLoader lifecycle.
- [ADR-003](ADR-003-per-user-data-store-config.md) — Per-request adapter resolution via `IRepositoryFactory`; the source of the `RepositoryBundle` used inside each DataLoader batch function.
- [ADR-006](ADR-006-rest-and-graphql-dual-transport.md) — Identifies the N+1 problem and names DataLoader as the solution; this ADR provides the design.
- [ADR-010](ADR-010-multi-tenancy-data-isolation.md) — Per-user data isolation via RLS; documents why RLS alone cannot protect against a stale in-memory DataLoader cache.
