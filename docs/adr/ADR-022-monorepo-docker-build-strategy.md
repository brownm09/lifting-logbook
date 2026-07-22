# ADR-022: Monorepo Docker Build Strategy — Full Copy Over Turbo Prune

**Status:** Accepted
**Date:** 2026-05-23
**Closes:** [#310](https://github.com/merickvaughn/lifting-logbook/issues/310) (image-size optimization deferred)

---

## Context

The API Dockerfile builds in a multi-stage pipeline inside a Turborepo npm-workspaces monorepo.
The canonical Turborepo documentation recommends `turbo prune --docker` to produce a minimal
subset of the repo containing only the packages a given app depends on, which reduces builder
image size and cache invalidation surface.

Between PRs [#311](https://github.com/merickvaughn/lifting-logbook/pull/311) and
[#317](https://github.com/merickvaughn/lifting-logbook/pull/317), five successive fixes were
required to get the API container running in production. Each fix patched a different symptom
of the same root cause: `turbo prune` was silently dropping dependencies.

**Observed failures with `turbo prune`:**

1. **Missing workspace packages** — `turbo prune` produced a tree that excluded `packages/core`
   and `packages/types`. The runner stage had dangling `node_modules/@lifting-logbook/*` symlinks
   that resolved to nothing, causing `MODULE_NOT_FOUND` at startup.

2. **Missing workspace-local `node_modules`** — npm hoists most packages to the root
   `node_modules`, but version-conflicting packages (e.g., `@fastify/multipart`) live at
   `apps/api/node_modules`. `turbo prune` did not copy these; the API crashed on the first
   Fastify request with a module resolution error.

3. **Prisma client generation order** — `turbo prune` reordered the builder steps in a way that
   ran `tsc` before `prisma generate`, producing `TS2694: namespace 'PrismaClient' has no
   exported member 'InputJsonValue'`.

4. **Turbo remote cache incompatibility** — the pruned tree was missing the `turbo.json`
   workspace graph entries for sibling packages, causing the remote-cache lookup to produce a
   false hit and skip compilation entirely.

Each individual fix was non-obvious and required reading turbo internals. The accumulation of
five PRs in four days indicated that `turbo prune` was not a reliable abstraction for this
project's workspace layout.

---

## Decision

**Skip `turbo prune` entirely.** Copy the full repo into the builder stage, run `npm ci` and
`npx turbo run build --filter=@lifting-logbook/api`. In the runner stage, selectively copy
the compiled output and the node_modules paths that node's module-resolution algorithm actually
needs to walk:

- Root `node_modules/` (hoisted deps + workspace symlinks)
- `packages/core/` and `packages/types/` (symlink targets)
- `apps/api/dist/` (compiled output)
- `apps/api/node_modules/` (workspace-local deps that did not hoist)
- `apps/api/package.json` (module resolution root hint)
- `apps/api/prisma/` (schema + migrations, needed at runtime for `migrate deploy`)

`prisma generate` runs explicitly before `turbo build`, independent of the build pipeline order.

---

## Consequences

**Accepted trade-offs:**
- Builder image is larger (full monorepo source). For this project's current size the difference
  is negligible; image-size optimization is tracked in issue #310 for a future milestone.
- Cache invalidation is coarser: any change to any package invalidates the `npm ci` layer.
  This is acceptable while the monorepo is small and CI runtime is under two minutes.

**Benefits:**
- No silent dependency omissions. The runner's module-resolution walk is identical to a local
  `node run` from the repo root, so runtime `MODULE_NOT_FOUND` errors in CI predict local
  failures, not production-only surprises.
- `prisma generate` timing is explicit and not subject to turbo's task-graph inference.
- The Dockerfile is self-contained and readable without understanding turbo prune semantics.

**Worktree note:** the same npm-workspaces sensitivity that caused the Docker failures applies
to local git worktrees. A new worktree does not inherit a working `node_modules` from the main
repo. Always run `npm install` from the worktree root before the first commit. See the
**Worktree Setup** section in `CLAUDE.md`.

---

## References

- [Turborepo — Pruning documentation](https://turbo.build/repo/docs/guides/tools/docker)
- [npm workspaces — Hoisting behavior](https://docs.npmjs.com/cli/v10/using-npm/workspaces#installing-workspaces)
- PRs: [#311](https://github.com/merickvaughn/lifting-logbook/pull/311), [#313](https://github.com/merickvaughn/lifting-logbook/pull/313), [#315](https://github.com/merickvaughn/lifting-logbook/pull/315), [#317](https://github.com/merickvaughn/lifting-logbook/pull/317)
- Issue [#310](https://github.com/merickvaughn/lifting-logbook/issues/310): deferred image-size optimization
