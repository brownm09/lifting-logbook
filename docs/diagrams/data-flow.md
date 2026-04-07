# Data Flow — Request Path

A single request from a client through the full stack: transport authentication,
per-user adapter resolution, domain logic execution, and persistence.

```mermaid
sequenceDiagram
    participant Client as Client<br/>(web / mobile)
    participant Transport as Transport Layer<br/>(REST Controller or GraphQL Resolver)
    participant Auth as IAuthProvider<br/>(Clerk Adapter)
    participant Factory as IRepositoryFactory
    participant Service as Domain Service<br/>(packages/core)
    participant Repo as IWorkoutRepository<br/>(Sheets or Postgres Adapter)
    participant Store as Data Store<br/>(Google Sheets / PostgreSQL)

    Client->>Transport: HTTP request + JWT
    Transport->>Auth: verify(jwt)
    Auth-->>Transport: AuthUser (user_id · adapter_type)
    Transport->>Factory: forUser(authUser)
    Note right of Factory: Reads user_data_source<br/>Returns correct adapter<br/>(cached ~5 min TTL)
    Factory-->>Transport: RepositoryBundle
    Transport->>Service: execute(input, repositoryBundle)
    Service->>Repo: read / write domain objects
    Repo->>Store: API call (Sheets) or SQL query (Postgres)
    Store-->>Repo: raw data
    Repo-->>Service: domain objects
    Service-->>Transport: result
    Transport-->>Client: HTTP response (JSON)
```

**Key points:**
- The transport layer never contains business logic — it authenticates, resolves adapters, and delegates.
- The domain service (`packages/core`) is unaware of which adapter is in use; it interacts only with port interfaces.
- Adapter selection is per-user, per-request, enabling different users to be on different data stores simultaneously (Sheets vs. Postgres).
- REST and GraphQL share the same service call path — only the transport wrapper differs.

**See also:** [ADR-003: Per-User Data Store Configuration](../adr/ADR-003-per-user-data-store-config.md) ·
[ADR-004: Multi-Data-Store Adapter Strategy](../adr/ADR-004-multi-data-store-adapters.md) ·
[ADR-006: Dual Transport Layer](../adr/ADR-006-rest-and-graphql-dual-transport.md)
