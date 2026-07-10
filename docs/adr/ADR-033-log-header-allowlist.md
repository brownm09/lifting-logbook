# ADR-033: Log Header Redaction Is an Allowlist (Redact-by-Default)

**Status:** Accepted
**Date:** 2026-07-10
**Closes:** [#780](https://github.com/brownm09/lifting-logbook/issues/780)
**Related:** [ADR-018](ADR-018-observability-stack.md) (logging stack; the original denylist decision)

---

## Context

`apps/api` logs HTTP request/response metadata through `nestjs-pino`. pino-http's default
request serializer emits `req.headers` verbatim, which — written to long-retention log storage in
Grafana Cloud Loki — is a standing credential-leak risk.

The original mitigation ([ADR-018](ADR-018-observability-stack.md)) was a pino `redact.paths`
**denylist**: a hand-maintained list of specific header names to strip (`authorization`, `cookie`,
`set-cookie`). This is incomplete-by-design. Any auth-bearing header *not* on the list logs in
plaintext until someone notices.

That failure materialised in [#767](https://github.com/brownm09/lifting-logbook/issues/767):
server-to-server calls from `apps/web` carry the Clerk JWT in `x-clerk-authorization` rather than
`authorization` (see `auth.guard.ts`). It was absent from the denylist, so full Clerk JWTs were
written to GCP Cloud Logging in plaintext for weeks with no signal, until manual inspection found
them. [PR #771](https://github.com/brownm09/lifting-logbook/pull/771) added the one missing header,
but its review flagged that the denylist pattern would recur for the next auth header anyone
introduced. This ADR records the systemic fix.

## Decision

Invert the mechanism from a denylist to an **allowlist** — redact by default.

1. **Allowlist serializer (primary).** `pinoHttpOptions.serializers.req` / `.res` run pino's
   standard serializer, then keep only the headers named in the exported
   `LOGGABLE_REQUEST_HEADERS` set; every other header is dropped before it is written. A
   newly-introduced header — including an auth-bearing one nobody has named yet — is therefore
   **not logged unless it is explicitly added to the allowlist.** Safe by construction.
2. **Denylist backstop (defense-in-depth).** The existing `redact.paths` list is retained for the
   highest-risk bearer headers and cookies, so that if a future refactor removes or bypasses the
   serializer, those known credential carriers are still stripped. It is explicitly *not* the
   primary mechanism and need not grow as new headers appear.
3. **CI guard test.** `apps/api/src/log-header-allowlist.spec.ts` asserts (a) no entry in
   `LOGGABLE_REQUEST_HEADERS` matches a credential-bearing name pattern
   (`/authorization|token|cookie|api[-_]?key|secret|…/i`), so mistakenly allowlisting a sensitive
   header fails the build; and (b) a batch of known *and novel* auth headers never reaches the
   serialized log line, while a safe header does. The leak class becomes a build failure rather
   than a production discovery.

### Logging-contract change

Request/response logs now contain only allowlisted headers (`host`, `user-agent`, `content-type`,
`content-length`, `x-request-id`, `x-forwarded-*`, `traceparent` / `tracestate`, …) instead of
all-headers-minus-a-few. To log an additional header, add its lowercase name to
`LOGGABLE_REQUEST_HEADERS`; the guard test rejects credential-bearing names.

## Alternatives Considered

### Option 1: Guard test only, keep the denylist

Add the sensitivity-pattern test but leave `redact.paths` as the mechanism. Rejected as the
*primary* fix: a guard test can only assert about headers it enumerates, so it cannot catch a
genuinely novel header name that nobody added to the fixture — the exact gap that leaked
`x-clerk-authorization`. Only redact-by-default closes that structurally. The guard test is kept,
but as reinforcement for the allowlist, not a substitute for it.

### Option 2: Pattern-based redaction inside pino

pino's `redact` is backed by `fast-redact`, whose paths support wildcards (`req.headers.*`) but not
regex key matching, so "redact any header whose name matches `/…/`" is not expressible.
`req.headers.*` with `remove` would drop *all* headers with no way to re-include the safe ones.
Rejected — an allowlist serializer is the idiomatic way to express "keep only these".

### Option 3: Broaden the denylist

Add more known sensitive header names. Rejected — it is the same incomplete-by-design pattern with a
longer list; the next unlisted header still leaks.

## Consequences

### Positive

- A new auth-bearing header cannot leak by omission — it is dropped unless deliberately
  allowlisted, and allowlisting a credential-bearing name fails CI.
- Two independent layers (allowlist serializer + denylist backstop) protect credentials.
- Reduced log volume/cost: only useful headers are written to Loki.

### Negative / Risks

- **Contract change.** Headers not on the allowlist no longer appear in logs; a developer who
  relied on an arbitrary header in Loki must add it to `LOGGABLE_REQUEST_HEADERS`. Mitigated by the
  explanatory comment in `app.module.ts` and this ADR.
- The allowlist is still hand-maintained — but the failure mode is now *under*-logging a benign
  header (visible, harmless) rather than *over*-logging a secret (invisible, harmful).

## Verification

- `apps/api/src/log-header-allowlist.spec.ts` — allowlist contains no credential-bearing name;
  novel auth headers are dropped from the log line; a safe header survives.
- `apps/api/src/otel-log-redaction.spec.ts` (unchanged) — `authorization` / `cookie` /
  `x-clerk-authorization` stay out of both the pino wire format and the resulting OTel LogRecord.
- `npm test -w @lifting-logbook/api`, `npm run typecheck`.

## References

| Source | Relevance |
|---|---|
| [Pino — Redaction](https://getpino.io/#/docs/redaction) | The `redact.paths` mechanism and its path syntax; establishes that redaction is denylist-only and that wildcards match all keys at a level, not a name pattern. |
| [Pino — `serializers` option](https://getpino.io/#/docs/api?id=serializers-object) | The serializer hook used to filter `req` / `res` headers down to an allowlist before serialization. |
| [pino-std-serializers — README](https://github.com/pinojs/pino-std-serializers#readme) | `pino.stdSerializers.req` / `.res`, the standard serializers this config runs first and then post-processes to replace `headers` while preserving method / url / statusCode. |
| [OWASP — Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | Normative guidance that access tokens, session identifiers, and authorization headers must never be written to logs — the rule this ADR enforces by default. |
| [W3C — Trace Context](https://www.w3.org/TR/trace-context/) | Defines `traceparent` / `tracestate`, allowlisted because they carry correlation IDs (not credentials) and drive Loki↔Tempo navigation. |
