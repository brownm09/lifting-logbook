# Proposal: Grafana Cloud Observability Stack

**Status:** `draft`
**Date:** 2026-05-08
**Issue:** [#199](https://github.com/brownm09/lifting-logbook/issues/199)

---

## Problem

The repo has zero observability instrumentation: no OpenTelemetry SDK, no metrics, no
structured logging pipeline, no alerts. A request that fails across `apps/web` → `apps/api`
→ Postgres cannot be correlated end-to-end, and there is no signal that something is wrong
until a user reports it. This blocks on-call readiness and makes production incidents
unsolvable in reasonable time.

## Proposed Solution

Adopt OpenTelemetry as the instrumentation layer in `apps/api` (NestJS + Fastify) and
`apps/web` (Next.js), exporting traces, metrics, and structured logs to Grafana Cloud
(Tempo for traces, Mimir for metrics, Loki for logs). Define an initial set of RED-style
alerts on the API (request rate, error rate, p95 latency) and surface them to a single
notification channel. Land an ADR documenting the choice of OTel + Grafana Cloud over
alternatives (Honeycomb, Datadog, self-hosted) so future teams understand the trade-off.

## Acceptance Criteria

- [ ] `@opentelemetry/sdk-node` is installed and initialized in `apps/api` and emits traces for HTTP requests and outbound Postgres queries
- [ ] `@opentelemetry/sdk-trace-web` (or Next.js OTel integration) is installed in `apps/web` and emits traces from server components and route handlers, with trace context propagated to `apps/api`
- [ ] An OTel Collector is deployed and exports to Grafana Cloud over OTLP (deployment topology — sidecar, DaemonSet, etc. — decided at implementation time per Open Questions)
- [ ] RED metrics for `apps/api` are visible in a Grafana dashboard committed to the repo as code (JSON or Grafana-as-code)
- [ ] Structured logs from `apps/api` flow to Loki with `trace_id` and `span_id` attached for log↔trace correlation
- [ ] Three alert rules exist and route to a notification channel: API error-rate > 1%, p95 latency > 1s, no requests for 10m
- [ ] An ADR is written explaining the choice of OTel + Grafana Cloud, with primary-source citations
- [ ] `docs/runbooks/observability.md` documents how to access dashboards, query traces, and silence alerts

## Out of Scope

- Frontend RUM (real user monitoring) and Web Vitals — defer to a follow-up
- Profiling (Pyroscope) — defer
- SLO definitions and error budgets — owned by [#201 (On-Call Readiness)](2026-05-08-on-call-readiness.md); depend on real traffic data and live alongside the on-call work
- Synthetic monitoring / external probes — defer
- Mobile (`apps/mobile`) instrumentation — defer until the mobile app has real traffic

## Open Questions

- Cloud Run vs GKE sidecar pattern for the OTel Collector — likely depends on which deployment target ships first
- Whether to enable OTel autoinstrumentation for Prisma or use manual instrumentation
- Sampling strategy: head-based vs tail-based; what % to start with

## References

- [OpenTelemetry specification](https://opentelemetry.io/docs/specs/otel/) — protocol and SDK contract
- [Grafana Cloud OTLP endpoint docs](https://grafana.com/docs/grafana-cloud/send-data/otlp/) — ingestion contract for the chosen backend
- [W3C Trace Context](https://www.w3.org/TR/trace-context/) — the propagation format OTel uses across service boundaries
- [Google SRE Book — Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/) — the RED/USE framing the alert rules are built on
