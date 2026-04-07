# Hexagonal Architecture (Ports and Adapters)

`packages/core` contains pure domain logic with zero infrastructure dependencies. All
external concerns — data storage, authentication, transport — are accessed through port
interfaces and implemented as swappable adapters.

**Dependency rule:** source-code dependencies point inward. Transport and adapters depend
on ports and core. Core depends on nothing outside itself.

Solid arrows = call / depend on. Dashed arrows = implements.

```mermaid
graph TB
    subgraph clients["Clients"]
        Web["apps/web\n(Next.js)"]
        Mobile["apps/mobile\n(Expo)"]
    end

    subgraph transport["Transport · apps/api/src/transport"]
        REST["REST Controllers\n/api/rest/v1/"]
        GQL["GraphQL Resolvers\n/api/graphql"]
    end

    subgraph domain["Domain · packages/core"]
        Services["Domain Services\n(RPT logic · progression math)"]
        Models["Models / Parsers"]
    end

    subgraph ports["Port Interfaces · apps/api/src/ports"]
        IAuth["IAuthProvider"]
        IFactory["IRepositoryFactory"]
        IRepos["IWorkoutRepository\nITrainingMaxRepository\nILiftRecordRepository · …"]
    end

    subgraph adapters["Adapters · apps/api/src/adapters"]
        Clerk["Clerk\nAuth Adapter"]
        Sheets["Google Sheets\nRepository Adapters"]
        PG["PostgreSQL\nRepository Adapters"]
    end

    Web -->|HTTP| REST
    Web -->|HTTP| GQL
    Mobile -->|HTTP| REST
    Mobile -->|HTTP| GQL
    REST --> Services
    GQL --> Services
    Services --> IAuth
    Services --> IFactory
    IFactory --> IRepos
    Clerk -.->|implements| IAuth
    Sheets -.->|implements| IRepos
    PG -.->|implements| IRepos
```

**See also:** [ADR-002: Hexagonal Architecture](../adr/ADR-002-ports-and-adapters.md) ·
[ADR-003: Per-User Data Store Configuration](../adr/ADR-003-per-user-data-store-config.md) ·
[ADR-006: Dual Transport Layer](../adr/ADR-006-rest-and-graphql-dual-transport.md)
