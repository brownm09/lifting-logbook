# ADR-018: Observability Stack — OpenTelemetry + Grafana Cloud

**Status:** Accepted
**Date:** 2026-05-08
**Closes:** [#204](https://github.com/brownm09/lifting-logbook/issues/204) (records the decision for tracking epic [#199](https://github.com/brownm09/lifting-logbook/issues/199))

---

## Context

The repo has zero observability instrumentation. There is no OpenTelemetry SDK, no metrics pipeline, no structured logging, and no alerting. A request that fails across `apps/web` → `apps/api` → Postgres cannot be correlated end-to-end, and the system has no signal that something is wrong until a user reports it. Tracking issue [#199](https://github.com/brownm09/lifting-logbook/issues/199) plans the full rollout across five child PRs ([#204](https://github.com/brownm09/lifting-logbook/issues/204)–[#208](https://github.com/brownm09/lifting-logbook/issues/208)); this ADR locks in the technology and topology decisions so each child PR has a fixed reference.

Three categories of decision must be made before any code lands:

1. **Backend.** Where do traces, metrics, and logs go? Vendor (Honeycomb, Datadog, Grafana Cloud), self-hosted (Tempo + Loki + Mimir), or per-signal split.
2. **Instrumentation library.** The OpenTelemetry SDK is the only realistic choice on Node.js today, but the deployment topology (DaemonSet vs. sidecar vs. agentless), Prisma instrumentation strategy, sampling policy, and logger choice all need to be decided.
3. **Local-dev verification path.** Production is not yet receiving traffic; the team needs a way to verify spans, logs, and metrics flow end-to-end without burning Grafana Cloud quota or blocking on credentials.

---

## Decision

### Backend: Grafana Cloud (Tempo / Mimir / Loki) via OpenTelemetry OTLP

`apps/api` and `apps/web` instrument with the OpenTelemetry SDK and export OTLP/HTTP to a single OTel Collector. The Collector fans out: traces → Tempo, metrics → Mimir, logs → Loki. Local development runs the same Collector against a docker-compose stack (Tempo + Loki + Prometheus + Grafana); production points the Collector at Grafana Cloud's OTLP endpoint via env vars.

### Collector topology: GKE DaemonSet, Cloud Run sidecar template

GKE production deployments run the Collector as a DaemonSet — one Collector pod per node, receiving OTLP from every workload pod over the node-local network. This matches [ADR-009](ADR-009-infrastructure-kubernetes-cloud-run.md)'s GKE-first stance. Cloud Run cannot run DaemonSets; a sidecar config is templated for future use but not deployed in this epic.

### Prisma instrumentation: official `@prisma/instrumentation`

Use `@prisma/instrumentation` rather than wrapping Prisma calls manually. It is published by the Prisma team, hooks into the same internal events Prisma uses for its own logging, and produces spans with the SQL query, parameters (when configured), and duration. Manual span wrapping at every call site is rejected because it is high-maintenance, easy to forget, and duplicates effort already done by the official package.

### Sampling: head-based, 100% at start

Until production receives real traffic, every span is exported. Sampling decisions must be informed by traffic shape, error patterns, and which traces are interesting at scale — none of which are observable today. Tail-based sampling (which requires the Collector to buffer spans long enough to make a sampling decision after the trace completes) is deferred until traffic exists.

### API logger: `nestjs-pino` with OTel context hook

Replace the default NestJS logger (synchronous, console-only, no JSON) with `nestjs-pino`. Pino is the JSON logger named in NestJS's official ecosystem, is faster than alternatives by a meaningful margin, and is recommended in the NestJS techniques docs. The OTel context hook injects `trace_id` and `span_id` from the active span context into every log line so Loki and Tempo can cross-link in Grafana.

---

## Alternatives Considered

### Honeycomb

Honeycomb is a tracing-first vendor with strong query ergonomics. It was rejected on three grounds: it does not host metrics or logs (so it would not satisfy the full proposal scope on its own), pricing scales with event volume rather than infrastructure cost (worse fit for a pre-traffic project), and adopting it requires committing to a single vendor's query language (BubbleUp) rather than the portable OTel / PromQL / LogQL family.

### Datadog

Datadog hosts traces, metrics, and logs in one product. It was rejected primarily on cost: per-host and per-ingested-event pricing add up rapidly even at low volume, and the project has no budget allocated. The Datadog Agent also encourages using its own SDK over OTLP, which would complicate any future migration. OTLP support exists but is a second-class path.

### Self-hosted Tempo + Loki + Mimir on GKE

The same backend stack Grafana Cloud sells, but operated by us on the same cluster as the application. Rejected because the operational burden — running Tempo's compactor and ingester scale separately from Loki, sizing object storage, managing Grafana itself, handling retention and backups — is wildly disproportionate to the project's current size. Local dev still runs the self-hosted stack via docker-compose, which is a reasonable approximation; production avoids the ops cost.

### Cloud-provider-native (Cloud Trace + Cloud Logging + Cloud Monitoring)

GCP's first-party stack would integrate trivially given the existing infrastructure ([ADR-009](ADR-009-infrastructure-kubernetes-cloud-run.md)). It was rejected because Cloud Trace's query interface is weaker than Tempo's, log↔trace correlation requires nonstandard structured field names, and committing to the GCP-native stack tightly couples observability to the cloud provider in a way that conflicts with this codebase's hexagonal-architecture spirit ([ADR-002](ADR-002-ports-and-adapters.md)).

---

## Consequences

### Positive

- **Single instrumentation contract.** OpenTelemetry is the de facto standard ([CNCF graduated project](https://www.cncf.io/projects/opentelemetry/)); migrating off Grafana Cloud later requires only changing the Collector exporter, not the application code.
- **Unified Grafana UX.** Tempo, Loki, and Mimir are designed to cross-link inside Grafana — clicking a `trace_id` in a log line jumps to the trace; clicking a span jumps to the matching log lines. This is the workflow the on-call runbook ([#208](https://github.com/brownm09/lifting-logbook/issues/208)) is built around.
- **Local-dev parity.** The docker-compose stack runs the same Tempo / Loki / Prometheus / Grafana images that Grafana Cloud manages, so a query that works locally works in production with the same syntax.
- **Endpoint-agnostic code.** All exporters read `OTEL_EXPORTER_OTLP_ENDPOINT` from the environment. Local dev points at the local Collector; production points at the Grafana Cloud OTLP endpoint. No code change between environments.

### Negative

- **Five-service local stack.** docker-compose grows from one service (Postgres) to six (Postgres + Tempo + Loki + Prometheus + Grafana + otel-collector). Cold-start cost for `docker compose up` will increase noticeably; the runbook will document that the observability stack is opt-in via a profile.
- **No SLOs yet.** Three RED alert rules ship in [#207](https://github.com/brownm09/lifting-logbook/issues/207) — error-rate > 1%, p95 > 1s, no-requests-10m — but proper SLOs and error budgets are explicitly deferred to [#201 (On-Call Readiness)](../proposals/2026-05-08-on-call-readiness.md). The initial alerts are coarse signals, not refined SLO violations.
- **Head-based 100% sampling.** Will not scale to high-traffic production. Must be revisited before public launch; the threshold and policy live in a follow-up issue, not this ADR.
- **Prisma autoinstrumentation has caveats.** It instruments Prisma Client calls but not raw `$queryRaw` / `$executeRaw` invocations. Code that uses raw SQL must add manual spans if those queries should be traced.

---

## Implementation outline

The five child PRs of [#199](https://github.com/brownm09/lifting-logbook/issues/199) implement this ADR:

| Child | Scope |
|---|---|
| [#204](https://github.com/brownm09/lifting-logbook/issues/204) | This ADR (no code). |
| [#205](https://github.com/brownm09/lifting-logbook/issues/205) | `apps/api`: OTel SDK bootstrap (`apps/api/src/otel.ts`), Prisma instrumentation, `nestjs-pino` with trace-context hook. |
| [#206](https://github.com/brownm09/lifting-logbook/issues/206) | `apps/web`: `apps/web/instrumentation.ts` via `@vercel/otel`; W3C `traceparent` propagation. |
| [#207](https://github.com/brownm09/lifting-logbook/issues/207) | `infra/observability/otel-collector.yaml`; docker-compose extensions; `infra/kubernetes/charts/otel-collector/`; Cloud Run sidecar template; RED dashboard JSON; three Prometheus alert rules. |
| [#208](https://github.com/brownm09/lifting-logbook/issues/208) | `docs/runbooks/observability.md`; README links; ROADMAP shipped row. |

---

## References

| Source | Relevance |
|---|---|
| [OpenTelemetry — Specification](https://opentelemetry.io/docs/specs/otel/) | Normative protocol and SDK contract; the wire format every exporter and collector implements. |
| [OpenTelemetry — JavaScript / Node.js SDK](https://opentelemetry.io/docs/languages/js/) | The `@opentelemetry/sdk-node` package documentation; covers instrumentation registration, resource detection, and exporter configuration used by `apps/api/src/otel.ts`. |
| [OpenTelemetry — Collector](https://opentelemetry.io/docs/collector/) | Collector architecture, receiver/processor/exporter pipeline model, and deployment patterns; supports the DaemonSet vs. sidecar decision. |
| [Grafana Cloud — Send data via OTLP](https://grafana.com/docs/grafana-cloud/send-data/otlp/) | Authoritative ingestion contract for the chosen backend; defines the OTLP endpoint, authentication model, and per-signal limits. |
| [Grafana Tempo — Documentation](https://grafana.com/docs/tempo/latest/) | The trace store; covers OTLP ingest, storage backend selection, and Grafana integration used by the local docker-compose verification path. |
| [Grafana Loki — Documentation](https://grafana.com/docs/loki/latest/) | The log store; covers labels, LogQL, and the `traceID` derived field used to jump from log lines to traces. |
| [Grafana Mimir — Documentation](https://grafana.com/docs/mimir/latest/) | The Prometheus-compatible metrics store backing Grafana Cloud Metrics; the Prometheus alert rule format in `infra/observability/alerts/api.yaml` runs unchanged here. |
| [W3C — Trace Context](https://www.w3.org/TR/trace-context/) | The `traceparent` and `tracestate` HTTP header format used to propagate trace context from `apps/web` to `apps/api`. |
| [Prisma — OpenTelemetry tracing](https://www.prisma.io/docs/orm/prisma-client/observability-and-logging/opentelemetry-tracing) | Official Prisma OTel guide; documents `previewFeatures = ["tracing"]` in `schema.prisma`, required for `@prisma/instrumentation` to attach. |
| [`nestjs-pino` README](https://github.com/iamolegga/nestjs-pino) | The pino integration for NestJS; documents the `Logger` provider, request-scoped log context, and the `formatters` hook used to inject `trace_id` / `span_id`. |
| [NestJS — Techniques: Logger](https://docs.nestjs.com/techniques/logger) | Official NestJS logger guide; documents replacing the built-in logger with a custom implementation, which is what `nestjs-pino` does. |
| [Pino — Documentation](https://getpino.io/) | The underlying JSON logger; covers serialization performance and the formatter API used to attach OTel context. |
| [`@vercel/otel`](https://vercel.com/docs/observability/otel-overview) | Next.js's officially-recommended OTel wrapper; handles edge/Node.js runtime selection and integrates with Next.js's instrumentation hook. |
| [Next.js — OpenTelemetry](https://nextjs.org/docs/app/building-your-application/optimizing/open-telemetry) | The instrumentation API in Next.js 16 used by `apps/web/instrumentation.ts`. |
| [Google SRE Book — Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/) | The RED/USE framing the three alert rules in [#207](https://github.com/brownm09/lifting-logbook/issues/207) are built on. |
| [Prometheus — Alerting Rules](https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/) | The alert rule syntax in `infra/observability/alerts/api.yaml`; Mimir's rule format is identical. |
| [CNCF — OpenTelemetry graduation announcement](https://www.cncf.io/announcements/2024/01/22/opentelemetry-becomes-graduated-cncf-project/) | Documents OpenTelemetry's status as a graduated CNCF project; supports the "de facto standard" framing of the Decision section. |
| [ADR-002 — Ports and Adapters](ADR-002-ports-and-adapters.md) | The architectural rationale for keeping the application code endpoint-agnostic; the `OTEL_EXPORTER_OTLP_ENDPOINT` env var follows the same boundary discipline. |
| [ADR-009 — Infrastructure (GKE + Cloud Run)](ADR-009-infrastructure-kubernetes-cloud-run.md) | The GKE-first deployment stance that drives the DaemonSet topology choice. |
| [ADR-011 — API server (NestJS + Fastify)](ADR-011-api-server-nestjs-and-express.md) | Fastify is the underlying HTTP framework; the OTel HTTP autoinstrumentation hooks into the Fastify request lifecycle. |
| [ADR-013 — Testing strategy](ADR-013-testing-strategy.md) | The OTel smoke test in `apps/api` ([#205](https://github.com/brownm09/lifting-logbook/issues/205)) follows the Jest + in-memory adapter pattern from ADR-013. |
