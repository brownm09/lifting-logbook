# Service Level Objectives — `apps/api`

Defines the availability and latency SLOs for the Lifting Logbook API, the error budget
policy, and how compliance is measured. Methodology rationale is in
[ADR-019](../adr/ADR-019-slo-methodology.md).

---

## SLO Targets

| SLO | Target | Measurement window |
|---|---|---|
| Availability | 99.5% | 28-day rolling |
| p95 latency | < 1 s | 28-day rolling |

### Availability definition

A request is **good** if the API returns a non-5xx HTTP response. A request is **bad** if it
returns a 5xx response or the API fails to respond (connection reset, timeout at the load
balancer). Client-side 4xx responses (malformed input, auth rejection) are **not** counted as
bad — they represent expected user-error handling, not service failures.

PromQL expression:

```promql
1 - (
  sum(rate(http_server_request_duration_seconds_count{http_response_status_code=~"5.."}[28d]))
  /
  sum(rate(http_server_request_duration_seconds_count[28d]))
)
```

> **Note:** 28-day range vectors are expensive to evaluate ad-hoc. In production, pre-compute
> these via Prometheus recording rules — see [ADR-019](../adr/ADR-019-slo-methodology.md).

### Latency definition

The p95 of all request durations, measured end-to-end from the first byte received by Fastify
to the last byte of the response body written. Excludes TLS handshake time and load-balancer
overhead.

PromQL expression:

```promql
histogram_quantile(
  0.95,
  sum(rate(http_server_request_duration_seconds_bucket[28d])) by (le)
)
```

> **Note:** 28-day range vectors are expensive to evaluate ad-hoc. In production, pre-compute
> these via Prometheus recording rules — see [ADR-019](../adr/ADR-019-slo-methodology.md).

---

## Error Budget

Error budget = (1 − SLO target) × window duration.

| Window | Availability budget | Latency budget |
|---|---|---|
| 28 days (672 h) | **3.36 h** of bad responses | Not directly time-based; see burn-rate policy below |
| 30 days (720 h) | **3.60 h** of bad responses | — |

Availability budget is consumed any time the error rate is above zero. At a sustained 100%
error rate, the entire 28-day budget is exhausted in 3.36 hours.

---

## Error Budget Policy

### Burn-rate thresholds

| Burn rate | Estimated time to budget exhaustion | Response |
|---|---|---|
| > 14× | ~2 h | Page on-call immediately; treat as SEV1 candidate |
| > 6× | ~4 h | Page on-call; treat as SEV2 |
| > 3× | ~9 h | Create ticket; treat as SEV3 |
| ≤ 1× | Budget not at risk | No action required |

Burn rates are measured using a two-window strategy (short detection window ∧ long confidence
window) to suppress transient spikes. Burn-rate alert rules will be implemented once the
service receives enough sustained production traffic to calibrate the PromQL expressions.
Until then, the existing threshold alerts in `infra/observability/alerts/api.yaml` serve
as the primary on-call signal.

### Budget reset

The 28-day rolling window advances continuously — consuming budget today affects the window for
the next 28 days, not just the current calendar month. This means a severe incident early in
the month may make it difficult to deploy risky changes for several weeks.

### Monthly review

On the first business day of each month, the on-call engineer reviews:

1. How much error budget was consumed in the previous 30 days.
2. Whether any alerts fired that should not have (false positives).
3. Whether any real degradations went unalerted (gaps in coverage).
4. Whether the targets remain appropriately conservative or should be tightened.

Targets are reviewed and, if warranted, adjusted after the first 90 days of production traffic.

---

## Exclusions

The following are excluded from SLO measurement and do not count against the error budget:

- **Planned maintenance windows** — maintenance must be announced in the incident channel at
  least 24 hours in advance and marked as a silence in Grafana Alerting.
- **Clerk auth provider outages** — 5xx responses caused by Clerk's own service degradation
  (confirmed via [status.clerk.com](https://status.clerk.com)) are excluded. The on-call
  engineer must document the exclusion in the incident record.
- **GCP infrastructure incidents** — outages attributable to GKE, Cloud Run, Cloud SQL, or
  other GCP-managed services that are beyond the application's control. Document with the GCP
  incident number.

Exclusions must be recorded in the incident postmortem so they can be audited during the
monthly review.

---

## Measurement Infrastructure

SLO compliance is derived from the Prometheus metrics emitted by the OpenTelemetry SDK in
`apps/api` and collected by the OTel Collector:

- **Local dev:** Prometheus runs at `http://localhost:9090`; Grafana at `http://localhost:3030`
- **Production:** Grafana Cloud Metrics (Mimir); alert rules in
  `infra/observability/alerts/api.yaml` are applied to the Grafana Cloud stack

Ensure Mimir retention is set to **≥ 30 days** so 28-day window expressions have complete
data. Contact the Grafana Cloud portal (Stack → Settings → Data retention) to verify.

---

## References

- [ADR-019 — SLO Methodology](../adr/ADR-019-slo-methodology.md)
- [Google SRE Workbook — Chapter 5: Alerting on SLOs](https://sre.google/workbook/alerting-on-slos/)
- [Google SRE Book — Chapter 4: Service Level Objectives](https://sre.google/sre-book/service-level-objectives/)
