**Status:** Accepted
**Date:** 2026-05-10
**Closes:** [#222](https://github.com/brownm09/lifting-logbook/issues/222)

## Context

The test environment (`docker-compose.test.yml`) runs only Postgres — no OTel Collector,
Tempo, Loki, or Prometheus. Tests emit no spans and produce no trace data.

This was an implicit design choice: when the observability stack was introduced in
[ADR-018](ADR-018-observability-stack.md), the test compose file was left untouched
because the tracing infrastructure was conceived as a production and local-dev concern.
This ADR makes that decision explicit and records the rationale.

## Decision

Do not instrument the test environment with OpenTelemetry tracing.

## Rationale

**Tests assert on outcomes, not structure.** Tests verify that the correct data is
returned and the correct HTTP status codes are produced. Spans expose *how* a result
is achieved — query count, call order, timing. That is useful for observing production
behaviour but creates a brittle second assertion surface in tests: a refactor that
preserves observable behaviour but reorganises internals would break span-structure
assertions without indicating a real regression.

**Infra cost exceeds benefit.** Wiring tracing into tests would require running Tempo
(or an in-memory OTLP receiver) in `docker-compose.test.yml` and in every CI job.
That adds services, health-check wiring, and startup latency for no improvement in
functional confidence.

**Tail-based sampling is inverted by test loops.** [ADR-020](ADR-020-tail-based-sampling-policy.md)
chose a tail-based sampler to make production collection cheap by discarding
uninteresting traces after the fact. A test run that completes in milliseconds and
produces hundreds of traces does the opposite: every trace is interesting-by-default
to the test harness, so the sampler adds overhead without filtering anything.

**N+1 detection belongs at the query layer.** The most common motivation for
span-structure assertions is catching N+1 queries. This is better served by a
Prisma query-count assertion or a query-logging test helper that operates at the
ORM layer with zero OTel overhead.

## Alternatives Considered

**In-memory OTLP receiver.** A test-only OTLP sink would allow span-structure
assertions without running Tempo. Rejected: the assertion surface is still brittle
(see above), and it adds a test-only dependency with no production analogue.

**Span-count assertions for N+1 detection.** Feasible in isolation. Rejected in
favour of a dedicated query-counter at the Prisma layer, which is cheaper and does
not require OTel instrumentation to be active during tests.

## Consequences

- No span data is produced during test runs; CI has no trace visibility.
- If a future requirement demands span-structure assertions (e.g., SLO regression
  tests or a performance guardrail suite), an in-memory OTLP receiver can be
  introduced at that point without changing this decision for the general test suite.
- The mobile app (`apps/mobile`) is also uninstrumented; that gap is tracked
  separately under the Client Applications epic.

## References

| Source | Relevance |
|---|---|
| [ADR-018: Observability Stack](ADR-018-observability-stack.md) | Defines the production OTel pipeline this decision opts out of |
| [ADR-020: Tail-Based Sampling Policy](ADR-020-tail-based-sampling-policy.md) | Sampling rationale that would be inverted by test instrumentation |
| [ADR-013: Testing Strategy](ADR-013-testing-strategy.md) | Canonical test approach (Jest + Testcontainers); silent on OTel — this ADR fills that gap |
