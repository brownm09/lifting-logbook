# ADR-024: PrismaInstrumentation Excluded — OTel v2 SDK Incompatibility

**Status:** Accepted
**Date:** 2026-05-27
**Closes:** [#348](https://github.com/brownm09/lifting-logbook/issues/348)
**Related:** [ADR-018](ADR-018-observability-stack.md) (PrismaInstrumentation is an ADR-018 decision)

---

## Context

[ADR-018](ADR-018-observability-stack.md) decided to use `@prisma/instrumentation` for Prisma
Client tracing. The instrumentation was initially wired up as part of the observability epic but
had to be removed in PR #346 due to a runtime crash that blocked Cloud Run startup.

### Original crash (issue #348)

`@prisma/instrumentation@5.22.0` bundles its own nested copy of
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

### Attempted fix: postinstall cleanup (PR #352, staging failure)

A `postinstall` lifecycle script was added to `apps/api/package.json` to delete
`@prisma/instrumentation`'s nested `node_modules/@opentelemetry/` directory after every
`npm install` / `npm ci`. The intent was to force Node.js to resolve `sdk-trace-base` to the
hoisted v2.7.1, eliminating the v1/v2 API mismatch.

Staging proved this approach also fails. With the nested v1.x copy removed, `@prisma/instrumentation`
resolves to `sdk-trace-base@2.x` — but `sdk-trace-base@2.x` no longer exports `Span` as a public
class (it was made package-private in the v2.0 breaking change release). The crash changed, but was
not eliminated:

```
TypeError: import_sdk_trace_base.Span is not a constructor
    at /app/apps/api/node_modules/@prisma/instrumentation/dist/chunk-O7OBHTYQ.js:69:20
    at ActiveTracingHelper.createEngineSpan
```

### Root cause (confirmed)

`@prisma/instrumentation@5.22.0` is fundamentally incompatible with
`@opentelemetry/sdk-trace-base@2.x`. It uses `Span` as a public constructor import. That class
was made package-private in v2.0. No amount of version routing within the 5.x/2.x combination
produces a working result:

- Allow nested v1.x → `getActiveSpanProcessor is not a function` (v1 Span gets v2 tracer)
- Force hoisted v2.x → `Span is not a constructor` (v2 Span is not a public export)

---

## Decision

Exclude `PrismaInstrumentation` from the `instrumentations` array in `otel.ts` until the
Prisma v6 upgrade is completed. `@prisma/instrumentation@6.x` ships with native OTel v2 support
and will make both crashes impossible.

The import is retained in `otel.ts` to support the regression test in `otel.e2e.spec.ts`, which
verifies the package is importable and the constructor does not throw — an import-level signal
that the package is properly resolved on the dependency path.

---

## Alternatives Considered

### Option 1: Downgrade main OTel SDK to v1.x

Pin `@opentelemetry/sdk-node` back to v1.x. Rejected — regresses the entire OTel toolchain
shipped with [ADR-018](ADR-018-observability-stack.md) and bets on Prisma never moving to v2
(which it has, in v6).

### Option 2: npm `overrides`

Adding `overrides` to root `package.json` is the documented npm mechanism for forcing a single
transitive dependency version. Explored during this investigation; in npm 11.x with an existing
lockfile, scoped overrides targeting workspace-level transitive packages did not update the
already-pinned lockfile entries — the override was recorded as intent but installed packages
did not change. Deleting the lockfile and resolving fresh triggered peer dependency conflicts
because `@prisma/instrumentation` bundles a full OTel v1.x stack that conflicts with the main
app's `@opentelemetry/auto-instrumentations-node@0.75.0` peer dep on `@opentelemetry/core@^2.0.0`.
This approach is also moot: even if it worked, it would route `@prisma/instrumentation` to v2.x
and hit the `Span is not a constructor` crash.

### Option 3: postinstall script (explored, staging failure)

Implemented and tested in staging. Documented above. Not used.

### Option 4: Upgrade `@prisma/instrumentation` to v6 (deferred)

`@prisma/instrumentation@6.x` ships with OTel SDK v2 support natively. The correct fix, but
upgrading `@prisma/client` from v5 → v6 involves `rejectOnNotFound` removal, schema engine
options changes, and other migration work that belongs in a dedicated PR. Tracked separately
so that the startup crash fix (excluding the instrumentation) ships now.

---

## Consequences

### Positive

- Cloud Run startup no longer crashes; `PrismaService.$connect()` completes cleanly.
- No lockfile changes required; no postinstall script to maintain.
- The regression test in `otel.e2e.spec.ts` provides an import-level signal that would fail
  if `@prisma/instrumentation` were accidentally removed from the dependency tree.

### Negative / Risks

- **Prisma Client spans are absent from traces** until the Prisma v6 upgrade. Query timing and
  connection lifecycle events will not appear in Grafana/Tempo.
- **Silent exclusion.** A developer adding Prisma queries will not see spans without reading the
  ADR. The comment in `otel.ts` provides the pointer.

---

## Verification

1. **Unit/smoke:** `npm test -w @lifting-logbook/api` — OTel smoke test (`otel.e2e.spec.ts`) and
   `PrismaInstrumentation` regression test both pass.
2. **Staging:** The Cloud Run startup probe passes. No `getActiveSpanProcessor` or
   `Span is not a constructor` crash in the startup logs.

---

## References

| Source | Relevance |
|---|---|
| [npm — `scripts` lifecycle (postinstall)](https://docs.npmjs.com/cli/v10/using-npm/scripts#npm-install) | Documents when `postinstall` is executed during `npm install` and `npm ci`. |
| [Prisma — OpenTelemetry tracing](https://www.prisma.io/docs/orm/prisma-client/observability-and-logging/opentelemetry-tracing) | Documents `@prisma/instrumentation` setup and the `previewFeatures = ["tracing"]` requirement. |
| [OpenTelemetry JavaScript — Changelog (v2.0)](https://github.com/open-telemetry/opentelemetry-js/blob/main/CHANGELOG.md) | Documents the v1 → v2 breaking changes to `sdk-trace-base`, including removal of the `getActiveSpanProcessor` tracer method and the `Span` public export. |
| [npm — `overrides` configuration](https://docs.npmjs.com/cli/v10/configuring-npm/package-json#overrides) | The idiomatic mechanism for forcing a single transitive dependency version; explored as a fix path and found insufficient. |
