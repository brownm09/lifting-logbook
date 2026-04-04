# ADR-011: API Server — NestJS Primary with Express Legacy Comparison

**Status:** Accepted
**Date:** 2026-04-03

---

## Context

The API server must support both REST and GraphQL transports ([ADR-006](ADR-006-rest-and-graphql-dual-transport.md)),
integrate with a dependency injection system that supports the `IRepositoryFactory` and
`IAuthProvider` ports ([ADR-002](ADR-002-ports-and-adapters.md)), and demonstrate awareness of
what a real-world migration from an older Node.js codebase looks like.

Two candidates were considered: **NestJS** (an opinionated TypeScript framework with a built-in
DI container, module system, and first-class GraphQL support) and **Express** (the dominant
legacy Node.js HTTP framework, minimal and un-opinionated).

---

## Decision

Use **NestJS** as the primary API server, with **Express** running as a secondary implementation
for explicit legacy comparison.

### NestJS (Primary) — `apps/api/`

NestJS is the primary server. It provides:
- Decorator-based DI container (`@Injectable`, `@Inject`)
- Module system for grouping related providers (`WorkoutModule`, `AuthModule`, etc.)
- `@nestjs/graphql` (code-first) for GraphQL alongside standard controllers for REST
- Interceptors and guards for cross-cutting concerns (auth, logging, error handling)
- Platform adapter: NestJS runs on **Fastify** (not the default Express) for better throughput

```
apps/api/src/
  modules/
    auth/           # AuthModule: IAuthProvider adapter, JWT guard
    workout/        # WorkoutModule: REST controller + GraphQL resolver
    maxes/          # MaxesModule: REST controller + GraphQL resolver
    cycle/          # CycleModule: REST controller + GraphQL resolver
  adapters/
    sheets/         # SheetsRepositoryBundle
    postgres/       # PostgresRepositoryBundle (Prisma)
    clerk/          # ClerkAuthProvider
  app.module.ts     # Root module, DI wiring
  main.ts           # Bootstrap (NestFactory with FastifyAdapter)
```

### Express (Legacy Comparison) — `apps/api-legacy/`

A second, independent implementation using Express with TypeScript. It:
- Manually wires routes, middleware, and repository instantiation
- Has no DI container — dependencies are passed explicitly (constructor injection by hand)
- Exposes REST endpoints only (no GraphQL — this is intentional; GraphQL is a NestJS strength)
- Calls the same `packages/core` services — the core layer is unchanged

```
apps/api-legacy/src/
  routes/
    workouts.ts
    maxes.ts
    cycles.ts
  middleware/
    auth.ts         # Manual JWT verification
    errorHandler.ts
  server.ts         # Express app + manual wiring
```

The legacy implementation is deployed as a separate container and is available at a documented
endpoint for comparison. It is **not** promoted to a production traffic-receiving endpoint but
is used for benchmarking and to illustrate the migration context.

### What the Comparison Demonstrates

| Concern | Express (Legacy) | NestJS (Primary) |
|---|---|---|
| Dependency injection | Manual (by hand) | Framework-provided container |
| Routing | Manual `app.get()` registration | Decorator-based (`@Get`, `@Post`) |
| GraphQL | Not implemented | `@nestjs/graphql`, code-first |
| Middleware | Manual `app.use()` | Guards, Interceptors, Pipes |
| Error handling | Manual try/catch + error middleware | Exception filters |
| Testability | Manual mock injection | Framework DI mock providers |
| Familiarity to enterprise teams | High (widely known) | High (Spring Boot-like) |
| Core service calls | Identical | Identical |

The last row is the key point. Both servers call the same `packages/core` services. The
hexagonal architecture ([ADR-002](ADR-002-ports-and-adapters.md)) is validated by the fact that
swapping the entire transport layer requires zero changes to domain logic.

---

## Rationale

**Why NestJS:**
- NestJS's module and provider system is recognizable to engineers from Spring Boot (Java/Kotlin)
  and ASP.NET Core (C#) backgrounds — the dominant enterprise frameworks. This is relevant for
  a director of engineering role where the audience includes engineers from diverse backgrounds.
- First-class TypeScript support, including full decorator metadata.
- `@nestjs/graphql` with the code-first approach allows REST and GraphQL resolvers to share
  module structure, keeping related logic together.
- DI container makes unit testing clean: inject mock adapters without framework-specific test
  utilities.

**Why Fastify as the NestJS platform adapter (instead of default Express):**
- NestJS supports both Express and Fastify as underlying HTTP adapters.
- Fastify has measurably better throughput (~2x in benchmarks for I/O-bound workloads) and
  built-in request/response schema validation.
- NestJS's Fastify adapter provides the same decorator API — no code changes required.

**Why keep Express:**
- The "legacy comparison" framing is a portfolio narrative: it concretely shows what an
  engineering team inherits when adopting a service built with minimal structure, and why
  migrating to NestJS provides value.
- Most Node.js backends in production today are Express-based. Demonstrating a migration path
  from Express to NestJS has immediate practical relevance for teams evaluating a director hire.

---

## Consequences

- Two API codebases to maintain. The legacy Express app is treated as a reference implementation,
  not a production service. It does not need to be kept current with every feature addition —
  it is a snapshot of a migration starting point.
- NestJS has a learning curve, particularly around the module system and decorator metadata.
  This is accepted as a deliberate investment.
- Fastify is not Express: some Express middleware (particularly those that depend on
  `req`/`res` being Express-flavored objects) is incompatible. Third-party middleware must be
  verified for Fastify compatibility or replaced with Fastify equivalents.

---

## Alternatives Considered

**Express only (no NestJS):** Lower overhead, simpler setup. Does not demonstrate the DI
and module patterns central to the portfolio goal. Ruled out.

**NestJS only (no Express comparison):** Cleanest approach. Ruled out because the legacy
comparison is explicitly part of the portfolio narrative — it demonstrates awareness of
real-world migration scenarios.

**Hono:** A newer, fast, edge-compatible HTTP framework. Interesting technology but limited
enterprise adoption. Ruled out on portfolio visibility grounds.

**tRPC:** Type-safe RPC between TypeScript clients and server, eliminates the REST/GraphQL
choice. Excellent DX but not REST or GraphQL — using it would undermine the goal of comparing
those two paradigms empirically ([ADR-006](ADR-006-rest-and-graphql-dual-transport.md)). Ruled
out for this project.
