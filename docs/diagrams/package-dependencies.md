# Monorepo Package Dependency Graph

Arrows indicate compile-time dependencies (`package.json` workspace references).
`packages/core` and `packages/types` have no local dependencies — they are the
foundation the rest of the monorepo builds on.

```mermaid
graph TB
    subgraph packages["packages/"]
        Core["packages/core\npure domain logic\n(services · models · parsers)"]
        Types["packages/types\nshared TypeScript interfaces\n& API contracts"]
    end

    subgraph apps["apps/"]
        API["apps/api\nNestJS + Fastify\n(primary API server)"]
        APILegacy["apps/api-legacy\nExpress\n(legacy comparison)"]
        Web["apps/web\nNext.js App Router"]
        Mobile["apps/mobile\nExpo (React Native)"]
    end

    API --> Core
    API --> Types
    APILegacy --> Core
    APILegacy --> Types
    Web --> Types
    Mobile --> Types
```

`apps/web` and `apps/mobile` depend on `packages/types` for shared API contracts
(request/response shapes) but not on `packages/core` — domain logic runs server-side only.

**See also:** [ADR-001: Monorepo Structure with Turborepo](../adr/ADR-001-monorepo-structure.md)
