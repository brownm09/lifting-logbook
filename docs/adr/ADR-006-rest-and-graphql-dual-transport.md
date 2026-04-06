# ADR-006: Dual Transport Layer — REST and GraphQL

**Status:** Accepted
**Date:** 2026-04-03

---

## Context

REST and GraphQL represent meaningfully different API design philosophies. REST is widely
understood, maps well to resource-oriented thinking, and is the dominant pattern in enterprise
APIs. GraphQL offers flexible querying, reduces over-fetching, and provides a strongly-typed
schema as a contract. Running both against the same domain logic allows a direct, empirical
comparison of the tradeoffs in a real application.

---

## Decision

Expose both a **REST API** and a **GraphQL API** from the same server, both backed by the same
core service layer.

```
/api/rest/v1/       ← REST endpoints (NestJS controllers or Express routes)
/api/graphql        ← GraphQL endpoint (NestJS @nestjs/graphql, code-first schema)
```

Both transports:
- Require authentication (JWT verified via `IAuthProvider`)
- Resolve the user's data store adapter via `IRepositoryFactory`
- Call core services from `packages/core`
- Never contain business logic

### REST Resource Design (initial)

```
GET    /api/rest/v1/training-maxes
PUT    /api/rest/v1/training-maxes

GET    /api/rest/v1/workouts/:cycleId/:weekId
POST   /api/rest/v1/workouts/:cycleId/:weekId/complete

GET    /api/rest/v1/cycles/:cycleId/dashboard
POST   /api/rest/v1/cycles

GET    /api/rest/v1/lift-records
POST   /api/rest/v1/lift-records
```

### GraphQL Schema (excerpt)

```graphql
type Query {
  trainingMaxes: [TrainingMax!]!
  workout(cycleId: ID!, weekId: ID!): Workout
  cycleDashboard(cycleId: ID!): CycleDashboard
  liftRecords(filter: LiftRecordFilter): [LiftRecord!]!
}

type Mutation {
  updateTrainingMaxes(input: [TrainingMaxInput!]!): [TrainingMax!]!
  startNewCycle(input: NewCycleInput!): CycleDashboard!
  recordLift(input: LiftRecordInput!): LiftRecord!
}
```

---

## Rationale

- **Empirical comparison:** Running both allows measurement of real differences: response
  payload size (GraphQL wins on over-fetch scenarios), query flexibility (GraphQL wins for
  nested data like workout → sets → lift records), operational simplicity (REST wins — no
  persisted queries, no N+1 tooling needed), caching (REST wins — HTTP caching is trivial;
  GraphQL requires Apollo Client or similar).
- **Portfolio breadth:** Demonstrates fluency with both paradigms and awareness of when each
  is appropriate.
- **Hexagonal architecture validates itself:** If the domain services are cleanly separated from
  the transport layer, adding GraphQL next to REST should require zero changes to core logic.
  This is a live demonstration of the pattern working.
- **NestJS supports both natively:** `@nestjs/graphql` with the code-first approach generates
  the SDL from TypeScript decorators on the same module structure used for REST controllers.

---

## Consequences

- Two API surfaces must be kept in sync as the domain evolves. In practice this means updating
  both controllers/resolvers when a new service operation is added.
- GraphQL requires attention to the **N+1 problem** for nested resolvers. DataLoader (batching)
  should be applied to any resolver that fetches related entities (e.g., fetching lift records
  for each workout in a list).
- REST versioning (`/v1/`) is handled via URL prefix. GraphQL versioning is handled via schema
  evolution (deprecation directives, additive changes). Both strategies should be documented.
- Clients (web, mobile) can choose which transport to use. The web app may use GraphQL for
  its flexible querying needs; the mobile app may prefer REST for simplicity and HTTP caching.

---

## Alternatives Considered

**REST only:** Lower maintenance surface. Appropriate for teams where GraphQL expertise is
limited. Ruled out because the explicit goal includes demonstrating both paradigms.

**GraphQL only:** Cleaner single contract. Ruled out because the explicit goal includes showing
what a REST migration looks like (the Express/NestJS legacy comparison serves a similar purpose).

**gRPC:** Relevant for internal service-to-service communication in microservice architectures.
Not appropriate here — this is a client-facing API for web and mobile clients that expect HTTP.

---

## References

- [GraphQL Specification (October 2021)](https://spec.graphql.org/October2021/) — The normative GraphQL language and type system specification.
- [NestJS — GraphQL Quick Start](https://docs.nestjs.com/graphql/quick-start) — Documents the code-first approach using `@nestjs/graphql` and TypeScript decorators to generate the SDL.
- [graphql/dataloader](https://github.com/graphql/dataloader) — The batching and caching utility for solving the N+1 problem in nested GraphQL resolvers; referenced in the Consequences section.
- [Apollo Client — Documentation](https://www.apollographql.com/docs/react/) — The GraphQL client library referenced for client-side caching; cited in the REST vs. GraphQL caching comparison.
- [NestJS — Controllers (REST)](https://docs.nestjs.com/controllers) — NestJS REST controller documentation using `@Get`, `@Post`, and related decorators.
