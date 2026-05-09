# ADR-020: Tail-Based Sampling Policy — Errors Always, Slow Always, 20% Clean

**Status:** Accepted
**Date:** 2026-05-09
**Closes:** [#210](https://github.com/brownm09/lifting-logbook/issues/210)
**Supersedes (partially):** [ADR-018](ADR-018-observability-stack.md) § Sampling

---

## Context

[ADR-018](ADR-018-observability-stack.md) locked in head-based 100% sampling at project start
because no production traffic existed to inform a more nuanced policy. The negative consequences
section of that ADR explicitly noted:

> "Head-based 100% sampling will not scale to high-traffic production. Tracked in
> [#210](https://github.com/brownm09/lifting-logbook/issues/210); revisit when sustained ingest
> crosses 1,000 spans/minute (24h avg) or monthly Grafana Cloud trace cost exceeds $25."

Issue #210 specifies a proactive approach: implement the sampling policy before the triggers are
crossed so it is live from the first day of real traffic, rather than scrambling to add it
after ingest costs begin accumulating.

The OTel Collector image already deployed
(`otel/opentelemetry-collector-contrib:0.104.0`) includes the `tail_sampling` processor with
no upgrade required.

---

## Decision

Replace head-based 100% sampling with **tail-based sampling at the Collector** using three
policies evaluated in order, where a trace is kept if any policy matches:

| Policy | Type | Condition | Action |
|---|---|---|---|
| `errors` | `status_code` | Any span in the trace has `STATUS_CODE_ERROR` | Always keep |
| `slow_traces` | `latency` | Total trace duration ≥ 1 000 ms | Always keep |
| `probabilistic` | `probabilistic` | All remaining traces | Keep `OTEL_TAIL_SAMPLE_RATE`% |

**Decision wait:** 10 seconds. The Collector buffers spans for up to 10 s before deciding whether
to keep or drop the trace. This is sufficient to see the full HTTP request/response span chain
across `apps/web` → `apps/api` → Postgres in normal operating conditions.

**Default sampling rate:** 20% for staging and production (driven by `tailSampleRate: "20"` in
`infra/kubernetes/charts/otel-collector/values.yaml`).

**Local dev override:** `OTEL_TAIL_SAMPLE_RATE: "100"` in `docker-compose.yml` keeps every trace
so local debugging is not affected by sampling.

---

## Rationale for tail-based over head-based ratio

Head-based ratio sampling (e.g., `parentbased_traceidratio` in the SDK) makes the
keep/drop decision at trace start, before any spans are recorded. This means:
- An error that occurred on the 5th span of a sampled-out trace is permanently discarded.
- A 10-second database query in a dropped trace is invisible.

Tail-based sampling at the Collector buffers the full trace and decides after all spans
arrive. The `errors` and `slow_traces` policies guarantee that every actionable trace is kept
regardless of the clean-trace sampling rate.

**Why at the Collector, not the SDK:** The OTel SDK's built-in samplers are all head-based.
Moving sampling to the Collector is the canonical approach for tail-based decisions and requires
no changes to application code. The Collector's `tail_sampling` processor is production-proven
and is the upstream recommendation for this use case.

---

## Alternatives Considered

### Head-based ratio (SDK `parentbased_traceidratio`)

Set `OTEL_TRACES_SAMPLER=parentbased_traceidratio` and
`OTEL_TRACES_SAMPLER_ARG=0.2` on each app. Simpler to configure — no Collector processor
needed — but cannot apply always-keep policies for errors or slow traces. A 20% ratio with
this sampler discards 80% of errors and 80% of slow traces. Rejected.

### Always_sample with Grafana Cloud ingest limits

Leave 100% sampling in place and rely on Grafana Cloud's free-tier ingest limit as a de facto
cap. Rejected: when the cap is hit, the backend silently drops the newest spans, which are
disproportionately the ones from active requests, defeating the purpose of observability.

### Composite policy with a rate limiter

The `tail_sampling` `composite` type can apply per-policy rate limits (e.g., always keep
errors up to N/s, probabilistic for the rest). Rejected as unnecessary complexity for current
traffic levels; the three-policy OR arrangement is sufficient and easier to reason about.

---

## Consequences

### Positive

- Errors and slow traces are guaranteed to reach Grafana Cloud regardless of sampling rate.
- Clean-path noise is reduced by 80% in production, extending Grafana Cloud free-tier headroom.
- The sampling rate is tunable per-environment without a code change (`OTEL_TAIL_SAMPLE_RATE`
  env var; defaults driven by `tailSampleRate` Helm value).
- Local dev retains 100% sampling; no debugging friction introduced.

### Negative

- **10-second memory window.** The Collector buffers spans for up to 10 s per trace. At very
  high span volumes this increases Collector memory pressure. The current resource limits
  (128 Mi request / 256 Mi limit) are unchanged; monitor if throughput grows significantly.
- **Sampling interacts with metrics.** The `probabilistic` policy drops spans from clean traces;
  any metrics derived from span counts (e.g., request-rate via span cardinality) will undercount
  by ~80% for clean-path traffic. Use the Prometheus/Mimir metrics pipeline for request counts
  — do not derive rate from traces.
- **20% clean-trace sampling means the p95 latency computed from sampled traces is an estimate.**
  Tail-sampled p95 is biased toward the retained slow traces. The `slow_traces` policy keeps
  all traces above 1 000 ms, so the p99 estimate is accurate; mid-distribution percentiles
  (p50, p75) are noisier than with 100% sampling.

---

## References

| Source | Relevance |
|---|---|
| [OpenTelemetry Collector contrib — `tail_sampling` processor](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor/tailsamplingprocessor) | Authoritative documentation for the processor used in this ADR; covers all policy types, `decision_wait` semantics, and known limitations. |
| [OpenTelemetry — Sampling](https://opentelemetry.io/docs/concepts/sampling/) | Conceptual overview of head-based vs. tail-based sampling; the basis for the Rationale section's framing. |
| [ADR-018 — Observability Stack](ADR-018-observability-stack.md) | The prior ADR this decision supersedes in part; documents the original 100% head-based sampling stance and the trigger conditions for revisiting it. |
| [ADR-019 — SLO Methodology](ADR-019-slo-methodology.md) | The burn-rate alerting framework built on top of the metrics pipeline; notes the interaction between sampling and metric accuracy referenced in the Consequences section. |
