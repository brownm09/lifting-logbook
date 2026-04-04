# ADR-002: Hexagonal Architecture (Ports and Adapters)

**Status:** Accepted
**Date:** 2026-04-03

---

## Context

The original GAS application already has a meaningful separation between `src/core/` (pure domain
logic with no Sheets dependencies) and `src/api/` (GAS adapter layer with repositories, UI
helpers, and controllers). This separation was informal — a product of good instinct — but not
enforced by a formal architectural pattern.

The cloud-native version must support multiple data stores, multiple transport protocols (REST and
GraphQL), multiple auth providers, and multiple deployment targets, all without the domain logic
being contaminated by infrastructure concerns. A formal pattern is warranted.

---

## Decision

Adopt **Hexagonal Architecture (Ports and Adapters)**, also known as the Clean Architecture
dependency rule as applied to the infrastructure boundary.

```
packages/core/            # Domain: services, models, pure logic. No I/O, no HTTP, no DB.
packages/types/           # Shared contracts: API types, event schemas.

apps/api/
  src/
    ports/                # TypeScript interfaces: IWorkoutRepository, IAuthProvider, etc.
    adapters/
      sheets/             # Google Sheets implementation of each port
      postgres/           # Postgres implementation of each port
      google-auth/        # Google OAuth implementation of IAuthProvider
      clerk-auth/         # Clerk implementation of IAuthProvider
    transport/
      rest/               # Express routes or NestJS controllers → call core services
      graphql/            # GraphQL resolvers → call the same core services
    app.ts                # Wires adapters to ports via dependency injection
```

**The dependency rule:** `core` and `ports` never import from `adapters` or `transport`.
Adapters and transport layers import from `core` and `ports`. Dependency flows inward.

---

## Rationale

- **Swappability:** Any adapter can be replaced without touching domain logic. The Postgres
  adapter can replace the Sheets adapter; a new auth provider can replace Clerk — all through
  changes to a single adapter file and its DI wiring.
- **Testability:** Core services can be unit-tested with in-memory mock adapters. No test
  infrastructure (DB, HTTP server) is needed to test business logic.
- **The existing `core/` is already compliant:** The GAS version's `src/core/` imports no GAS
  APIs. Migrating it means lifting it to `packages/core` with no logic changes.
- **Portfolio signal:** Hexagonal architecture is a well-understood pattern among senior
  engineers. Demonstrating it with working code (not just diagrams) communicates fluency.

---

## Consequences

- A `ports/` directory becomes the primary API contract between infrastructure and domain. Port
  interfaces must be kept minimal and expressive.
- Adding a new data store or auth provider is a well-defined, bounded task: implement the
  interface, register the adapter in DI.
- The pattern adds indirection. For very simple operations, the port/adapter split may feel like
  overhead. This is accepted given the explicit goal of demonstrating the pattern.

---

## Alternatives Considered

**Layered architecture (Controller → Service → Repository):** Common in Spring/Rails-style apps.
Easier to understand initially, but repository interfaces are often coupled to a specific
persistence technology. Less suited to the multi-adapter goal of this project.

**No formal pattern (ad hoc separation):** The current GAS version's approach. Works at small
scale but does not provide the enforcement or discoverability needed as the system grows.
