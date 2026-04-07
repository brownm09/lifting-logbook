# ADR-001: Monorepo Structure with Turborepo

**Status:** Accepted
**Date:** 2026-04-03
**Reviewed:** 2026-04-07
**Review outcome:** Pass

---

## Context

The cloud-native version of this application spans multiple deployable units: a backend API
server, a web frontend, and a mobile application. These units share TypeScript types and core
domain logic. Without a coordinated repository structure, shared code must either be duplicated
or published as npm packages, both of which introduce friction for a project at this stage.

---

## Decision

Use a **monorepo** with **Turborepo** for build orchestration.

Structure:
```
monorepo/
  packages/
    core/          # Pure domain logic — services, models, parsers, mappers
    types/         # Shared TypeScript interfaces and API contracts
  apps/
    api/           # Backend HTTP server
    web/           # Next.js frontend
    mobile/        # React Native (Expo) / Kotlin mobile client
  infra/
    kubernetes/
    cloud-run/
    terraform/
  docs/
    adr/
    README.md
```

---

## Rationale

- **Shared packages without publishing:** `packages/core` and `packages/types` are consumed by
  `apps/api`, `apps/web`, and `apps/mobile` via workspace references (`"@logbook/core": "*"`).
  No npm registry needed at this stage.
- **Incremental builds:** Turborepo caches build outputs per package, so changes to `apps/web`
  do not trigger a rebuild of `apps/api`.
- **Consistent tooling:** One `tsconfig`, one lint config, one test runner configuration at the
  root, with package-level overrides where needed.
- **Turborepo vs. Nx:** Both are capable. Turborepo has a lower configuration surface and
  integrates naturally with existing npm/yarn workspaces. Nx is more opinionated and provides
  more scaffolding — appropriate if the project grows to many more packages. Turborepo is the
  right default for this scale.

---

## Consequences

- All development happens in one repository; PRs and CI pipelines cover the full system.
- `packages/core` changes are immediately visible to all apps without a publish step.
- The monorepo structure is itself a portfolio artifact demonstrating familiarity with
  enterprise-scale repository organization patterns.
- Docker builds for individual apps require careful `COPY` scoping to include only the relevant
  workspace packages — this is handled with `turbo prune`.

---

## Alternatives Considered

**Polyrepo (separate repository per app):** Simpler git history per repo, but requires publishing
shared packages or using git submodules. Adds friction for a solo developer and makes atomic
cross-package changes harder.

**Single flat package:** Simplest structure, but loses the clean separation between domain logic
and infrastructure adapters that is central to the architectural goals of this project.

---

## References

- [Turborepo — Getting Started](https://turbo.build/repo/docs) — Official Turborepo documentation; covers caching model, pipeline configuration, and workspace setup.
- [Turborepo — `turbo prune`](https://turbo.build/repo/docs/reference/prune) — Pruning the monorepo to a minimal subgraph for Docker builds; referenced in the Consequences section.
- [npm Workspaces](https://docs.npmjs.com/cli/v10/using-npm/workspaces) — The npm workspace protocol used for inter-package references (`"@logbook/core": "*"`).
- [Nx — Getting Started](https://nx.dev/getting-started/intro) — The primary alternative considered; more opinionated and better suited to larger package counts.
