# ADR-019: SLO Methodology — Burn-Rate Alerting over Threshold Alerting

**Status:** Accepted
**Date:** 2026-05-09
**Closes:** [#201](https://github.com/merickvaughn/lifting-logbook/issues/201)

---

## Context

The observability stack ([ADR-018](ADR-018-observability-stack.md)) ships three RED-style
Prometheus alert rules (`APIHighErrorRate`, `APIHighP95Latency`, `APINoRequests`). These rules
use simple threshold conditions — when a metric crosses a fixed boundary for a sustained window,
an alert fires. That is sufficient for a pre-traffic service with no SLOs, but it is not a
durable model: threshold alerts decouple from the user-visible reliability promise, they fire
at the same cadence regardless of how much of the monthly budget has been consumed, and they
can't express "this burn rate will exhaust our budget in four hours."

Before this can be an on-call-ready service, two decisions need to be locked in:

1. **What are the SLO targets?** Availability and latency SLOs define what "reliable" means and
   what the error budget is. Without them there is no way to know whether an alert is actionable
   or noise.
2. **How should alerting relate to SLO compliance?** The choice is between threshold alerting
   (current state) and burn-rate alerting (the methodology described in the Google SRE Workbook,
   chapter 5). Both approaches can coexist; this ADR decides which is the primary on-call signal.

---

## Decision

### SLO targets

Adopt two SLOs for `apps/api`, measured over a 28-day rolling window:

| SLO | Target | Measurement |
|---|---|---|
| Availability | 99.5% | `1 − (5xx responses / total responses)` using `http_server_request_duration_seconds_count` from the OTel instrumentation |
| p95 latency | < 1 s | `histogram_quantile(0.95, ...)` using `http_server_request_duration_seconds_bucket` |

These targets are deliberately conservative for a pre-traffic service. They can be tightened
after 90 days of production data.

Error budget per window:

| Window | Availability budget | Notes |
|---|---|---|
| 28 days (672 h) | 3.36 h of 5xx responses | 0.5% × 672 h |
| 30 days (720 h) | 3.60 h of 5xx responses | Reference for monthly reviews |

### Alerting methodology: burn-rate alerting

Use burn-rate alerting as the primary on-call signal rather than simple threshold alerting.
A burn rate of 1× means the service is consuming error budget at exactly the sustainable rate
(would exhaust it precisely at the end of the 28-day window). Rates above 1× exhaust the budget
faster; rates below 1× are within SLO.

The Workbook's recommended two-window alerting strategy:

| Burn rate | Alert window | Look-back | Exhaustion at this rate | Action |
|---|---|---|---|---|
| > 14× | 5 m fast | 1 h slow | ~2 h | Page immediately (SEV1 candidate) |
| > 6× | 30 m fast | 6 h slow | ~4 h | Page (SEV2) |
| > 3× | 2 h fast | 1 d slow | ~9 h | Ticket (SEV3, next business day) |

The two-window check (short window ∧ long window both above threshold) suppresses spurious
alerts from transient spikes while catching sustained degradation quickly enough to act before
the budget is exhausted.

The existing threshold alerts (`APIHighErrorRate`, `APIHighP95Latency`, `APINoRequests`) are
preserved as leading indicators — they fire faster than burn-rate alerts and help surface the
nature of a degradation. Burn-rate alerts are the signal that SLO compliance is at risk.

Burn-rate alert rules are not implemented in this ADR; they will be added in a follow-up
issue once sustained traffic data establishes a realistic baseline request rate (the PromQL
expressions require it).

---

## Alternatives Considered

### Simple threshold alerting only (status quo)

The three existing rules fire when a metric crosses a fixed boundary. This is sufficient as an
early-warning system but has three weaknesses: (1) a 2% error rate for 10 minutes is treated
identically whether it happens on the first day of the month or the last, (2) low-traffic
periods can cause the alert to fire on a single failed request, and (3) it cannot express
"at this rate, we run out of budget in four hours." Retained as a secondary layer, not as the
primary SLO-compliance signal.

### Multi-window multi-burn-rate (full Workbook implementation)

The Workbook describes six alert rules covering three burn rates at two windows each, with
separate paging and ticket thresholds. This is the correct end state but is disproportionate for
a service that has no real traffic yet. The exact burn-rate numbers need to be calibrated against
actual request volume. Deferred until the service has 30+ days of production data.

### Error-budget-based alerting in Grafana SLO product

Grafana Cloud includes an SLO product that generates burn-rate alerts automatically from an SLO
definition. Ruled out for now because it introduces a Grafana-proprietary layer on top of the
Prometheus-compatible alert rules already established in [ADR-018](ADR-018-observability-stack.md).
Reconsider if the team grows and alert management overhead increases.

---

## Consequences

### Positive

- **SLOs tie on-call decisions to user experience.** An alert that fires because 0.3% of budget
  remains in the last hour of the month is more useful than an alert that fires because a counter
  crossed an arbitrary threshold.
- **Error budget enables risk conversations.** When a deploy regression burns 30% of the monthly
  budget in 20 minutes, the team has a shared vocabulary for the severity rather than debating
  whether a 3% error rate "feels bad."
- **Existing alerts are preserved.** The three threshold alerts continue to fire and can point
  an on-call engineer at the RED dashboard within minutes. Burn-rate alerts will layer on top,
  not replace them.

### Negative

- **Burn-rate alert rules require a request rate baseline.** The PromQL expressions divide by
  total request count; on a service with near-zero traffic, any error produces a 100% error
  rate and an infinite burn rate. Implementation is deferred until there is enough traffic to
  make the numbers meaningful.
- **Two-window alerting is harder to explain.** New on-call engineers need to understand both
  the burn rate concept and why two windows are required. The on-call guide and runbooks must
  document this clearly.
- **28-day rolling windows cannot be queried from a Prometheus scrape longer than its retention.**
  If Prometheus retention is set below 28 days, the window expression will silently use partial
  data. Grafana Cloud Metrics (Mimir) has configurable retention; ensure it is set to ≥ 30 days.

---

## Implementation outline

| Step | Owner | Notes |
|---|---|---|
| SLO doc (`docs/operations/slo.md`) | This PR | Defines the targets and error budget policy |
| On-call guide (`docs/operations/on-call.md`) | This PR | Severity mapping, escalation, postmortem |
| Runbooks (`docs/runbooks/`) | This PR | Four failure-mode runbooks |
| Alert rule annotations | This PR | Add `runbook_url` to existing threshold alerts |
| Burn-rate alert rules | Follow-up issue | After 30 days of production traffic |

---

## References

| Source | Relevance |
|---|---|
| [Google SRE Workbook — Chapter 5: Alerting on SLOs](https://sre.google/workbook/alerting-on-slos/) | Canonical source for burn-rate alerting methodology; defines the burn-rate concept, the two-window strategy, and the specific rate thresholds (14×, 6×, 3×) used above. |
| [Google SRE Book — Chapter 4: Service Level Objectives](https://sre.google/sre-book/service-level-objectives/) | Foundational SLO framing: SLI → SLO → error budget chain, measurement window semantics, and the rationale for choosing 99.5% availability over higher targets for early-stage services. |
| [Google SRE Book — Chapter 6: Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/) | The four golden signals (latency, traffic, errors, saturation); the two SLOs above correspond to the errors and latency signals. Also introduces the symptom-vs-cause alert framing. |
| [Prometheus — Recording Rules](https://prometheus.io/docs/prometheus/latest/configuration/recording_rules/) | Recording rules are required to evaluate burn-rate expressions efficiently at 28-day windows; the two-window strategy generates six pre-computed rates. Authoritative syntax reference. |
| [OpenSLO — Specification](https://openslo.com/) | YAML-based open standard for SLO definition across observability backends; the `docs/operations/slo.md` format is informed by OpenSLO's SLO object shape. |
