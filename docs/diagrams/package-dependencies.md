# Monorepo Package Dependency Graph

Arrows indicate compile-time dependencies (`package.json` workspace references).
`packages/core` and `packages/types` have no local dependencies — they are the
foundation the rest of the monorepo builds on.

```mermaid
graph TB
    subgraph packages["packages/"]
        Core["packages/core\npure domain logic\n(services · models · parsers)"]
        Types["packages/types\nshared TypeScript interfaces\n& API contracts"]
        ApiClient["packages/api-client\ntyped REST client\n(pluggable auth strategy)"]
    end

    subgraph apps["apps/"]
        API["apps/api\nNestJS + Fastify\n(primary API server)"]
        Web["apps/web\nNext.js App Router"]
        Mobile["apps/mobile\nExpo (React Native)"]
    end

    API --> Core
    API --> Types
    ApiClient --> Types
    Web --> Types
    Web --> ApiClient
    Mobile --> Types
```

`apps/web` and `apps/mobile` depend on `packages/types` for shared API contracts
(request/response shapes) but not on `packages/core` — domain logic runs server-side only.
`packages/api-client` is the single typed REST client shared by the web server and browser
code (and, in future, mobile); each consumer supplies only the auth-header strategy.

**See also:** [ADR-001: Monorepo Structure with Turborepo](../adr/ADR-001-monorepo-structure.md)
