# ADR-024: Resolve PrismaInstrumentation OTel SDK Version Conflict via postinstall cleanup

**Status:** Accepted
**Date:** 2026-05-27
**Closes:** [#348](https://github.com/brownm09/lifting-logbook/issues/348)
**Related:** [ADR-018](ADR-018-observability-stack.md) (PrismaInstrumentation is an ADR-018 decision)

---

## Context

[ADR-018](ADR-018-observability-stack.md) decided to use `@prisma/instrumentation` for Prisma
Client tracing. The instrumentation was initially wired up as part of the observability epic but
had to be removed in PR #346 due to a runtime crash that blocked Cloud Run startup.

**Root cause:** `@prisma/instrumentation@5.22.0` bundles its own nested copy of
`@opentelemetry/sdk-trace-base@1.30.1` under
`node_modules/@prisma/instrumentation/node_modules/`. The main app resolves
`@opentelemetry/sdk-trace-base@2.7.1` (transitively via `@opentelemetry/sdk-node@0.217.0`).

When the main app registers `PrismaInstrumentation` with its NodeSDK and Prisma later calls
`createEngineSpan()` during `PrismaService.onModuleInit()` → `$connect()`, Prisma's v1.x `Span`
constructor receives a tracer instance from the main app's v2.x SDK. The v1.x constructor calls
`parentTracer.getActiveSpanProcessor()` — a method removed in the v2.x tracer API — producing:

```
TypeError: parentTracer.getActiveSpanProcessor is not a function
    at new Span (.../prisma/instrumentation/node_modules/@opentelemetry/sdk-trace-base/...)
    at ActiveTracingHelper.createEngineSpan
```

This crash kills the process before the Cloud Run startup probe can pass.

---

## Decision

Add a `postinstall` lifecycle script to `apps/api/package.json` that deletes
`@prisma/instrumentation`'s nested `node_modules/@opentelemetry/` directory after every
`npm install` or `npm ci`. This forces Node.js module resolution to traverse up and use the
hoisted `@opentelemetry/sdk-trace-base@2.7.1`, so Prisma's code runs with the v2.x `Span`
constructor and the v2.x tracer API — no `getActiveSpanProcessor` mismatch.

```json
// apps/api/package.json
"scripts": {
  "postinstall": "node -e \"const fs=require('fs');try{fs.rmSync('node_modules/@prisma/instrumentation/node_modules/@opentelemetry',{recursive:true,force:true})}catch(e){}\""
}
```

**Why postinstall instead of npm `overrides`:**

`npm overrides` in the root `package.json` is the idiomatic mechanism for this fix. During
exploration, we found that in npm 11.x with an existing lockfile, scoped overrides targeting
workspace-level transitive packages do not update the lockfile entries already pinned there —
the override is recorded as intent but the installed packages do not change. Deleting the
lockfile and resolving fresh triggered peer dependency conflicts because `@prisma/instrumentation`
bundles a full OTel v1.x stack (`sdk-trace-base`, `core`, `resources`, `semantic-conventions`)
that conflicts with the main app's `@opentelemetry/auto-instrumentations-node@0.75.0` peer
dep on `@opentelemetry/core@^2.0.0`. The comprehensive override approach (forcing all four
packages to v2.x) resolved that conflict on a fresh install, but changed package hoisting in a
way that broke Jest module resolution for the NestJS test suite.

The postinstall approach avoids all of this: it preserves the original lockfile and hoisting,
applies on every `npm install` and `npm ci`, and is fully idempotent.

**Lifecycle:** `postinstall` runs unconditionally during `npm ci` (CI) and runs during
`npm install` whenever the workspace is installed or its dependencies change. If the nested
directory is reinstalled on a subsequent `npm install` (because npm detects it missing per the
lockfile), the script runs again on that pass and re-deletes it. The net state is always clean.

---

## Alternatives Considered

### Option 1: Downgrade main OTel SDK to v1.x

Pin `@opentelemetry/sdk-node` back to v1.x. Rejected — regresses the entire OTel toolchain
shipped with [ADR-018](ADR-018-observability-stack.md) and bets on Prisma never moving to v2
(which it has, in v6).

### Option 2: Upgrade `@prisma/instrumentation` to v6

`@prisma/instrumentation@6.x` ships with OTel SDK v2 support natively and would make this fix
a no-op. Rejected for this PR — upgrading `@prisma/client` from v5 → v6 involves schema engine
options changes, `rejectOnNotFound` removal, and other migration work that belongs in a
dedicated PR. This fix is tracked separately so Prisma v6 migration remains unblocked.

### Option 3: npm `overrides` (explored, not used)

Adding `overrides` to root `package.json` is the documented npm mechanism for this scenario.
Explored in detail; the limitation described above (existing lockfile not updated, fresh
resolution breaks hoisting) made the postinstall approach more reliable in practice. Should
be revisited if Prisma instrumentation is upgraded before the v6 migration, as a fresh
lockfile generated without an existing v1.x resolution may work correctly.

---

## Consequences

### Positive

- `PrismaInstrumentation` is restored per the original ADR-018 decision; Prisma Client spans
  (query timing, connection, disconnect) now appear in traces.
- Cloud Run startup no longer crashes on `$connect()`.
- The fix survives `npm ci` (CI), `npm install` (development), and lockfile regenerations.

### Negative / Risks

- **Lockfile still records the v1.30.1 nested entry.** The lockfile truthfully represents what
  `@prisma/instrumentation@5.22.0` declares; the fix is a post-install cleanup, not a lockfile
  change. A developer who inspects the lockfile will still see `1.30.1` listed. This is
  intentional — the lockfile is not modified.
- **Script runs on every install pass that changes the workspace.** Negligible overhead.
- **Future Prisma v6 upgrade.** Once `@prisma/instrumentation@6.x` is adopted (which ships OTel
  v2 natively), the nested `@opentelemetry/` directory will no longer exist and the `rmSync`
  call becomes a silent no-op. The script can be removed in the same PR as the upgrade.

---

## Verification

1. **Structural:** After `npm install`, confirm
   `apps/api/node_modules/@prisma/instrumentation/node_modules/@opentelemetry/` does not exist.
2. **Unit/smoke:** `npm test -w @lifting-logbook/api` — existing OTel smoke test
   (`otel.e2e.spec.ts`) passes.
3. **Staging:** The Cloud Run startup probe passes and staging traces show at least one
   `prisma:engine` or `prisma:client` span confirming `PrismaInstrumentation` is wired in.

---

## References

| Source | Relevance |
|---|---|
| [npm — `scripts` lifecycle (postinstall)](https://docs.npmjs.com/cli/v10/using-npm/scripts#npm-install) | Documents when `postinstall` is executed during `npm install` and `npm ci`. |
| [Prisma — OpenTelemetry tracing](https://www.prisma.io/docs/orm/prisma-client/observability-and-logging/opentelemetry-tracing) | Documents `@prisma/instrumentation` setup and the `previewFeatures = ["tracing"]` requirement. |
| [OpenTelemetry JavaScript — Changelog (v2.0)](https://github.com/open-telemetry/opentelemetry-js/blob/main/CHANGELOG.md) | Documents the v1 → v2 breaking changes to `sdk-trace-base`, including the tracer API changes producing the `getActiveSpanProcessor` crash. |
| [npm — `overrides` configuration](https://docs.npmjs.com/cli/v10/configuring-npm/package-json#overrides) | The idiomatic mechanism for forcing a single transitive dependency version; explored as the primary fix and deferred due to npm 11.x workspace lockfile limitations. |
