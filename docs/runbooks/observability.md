# Observability Runbook

Covers the local development stack, Grafana dashboards, trace queries, log↔trace
correlation, alert silencing, and Grafana Cloud credential wiring for production.

---

## Local stack startup

The docker-compose stack runs six services together:

| Service | Port(s) | Role |
|---|---|---|
| `db` | 5432 | PostgreSQL (app data) |
| `otel-collector` | 4317 (gRPC), 4318 (HTTP), 8889 (Prometheus exporter) | Receives OTLP spans/logs; fans out to Tempo and Loki |
| `tempo` | 3200 | Trace storage and query |
| `loki` | 3100 | Log storage and query |
| `prometheus` | 9090 | Metrics storage and query |
| `grafana` | 3030 | Dashboards, alerting, explore |

```sh
docker compose up -d
```

`otel-collector` waits for `tempo` and `loki` to pass health checks before it starts
accepting traffic, so all services are ready within ~30 seconds of the command completing.

To skip the database and start only the observability services:

```sh
docker compose up -d otel-collector tempo loki prometheus grafana
```

For `apps/api` to emit spans and logs to the local collector, add to `apps/api/.env`:

```
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

Start the API server as normal (`npm run dev`) and make any request — traces will appear
in Tempo within a few seconds (batch flush window: 5 s).

---

## Grafana login

Open **http://localhost:3030** in a browser. The local dev stack runs with anonymous
admin access (`GF_AUTH_ANONYMOUS_ENABLED=true`, `GF_AUTH_DISABLE_LOGIN_FORM=true`) — no
username or password is needed.

> The Grafana port is `3030`, not the default `3000`, to avoid conflicting with the
> Next.js dev server.

---

## Dashboard locations

The API RED dashboard is auto-provisioned from
[`infra/observability/dashboards/api-red.json`](../../infra/observability/dashboards/api-red.json)
on every stack startup.

Navigate to: **Dashboards → Lifting Logbook → API RED**

The dashboard shows three panels:

| Panel | Metric |
|---|---|
| Request rate | Requests/second by status code |
| Error rate | Fraction of 5xx responses over 5-minute window |
| Latency | p50, p95, p99 histograms |

All panels are Prometheus-backed, querying the OTel Collector's Prometheus exporter
(port 8889) via the pre-provisioned Prometheus datasource.

---

## Querying traces by `trace_id`

### From Grafana Explore

1. Open **Explore** (compass icon in the left nav).
2. Select the **Tempo** datasource from the dropdown.
3. Switch to the **Search** tab.
4. Paste the `trace_id` (32 hex characters) into the **Trace ID** field.
5. Click **Run query**.

### Using TraceQL

In the same Explore view, switch to the **TraceQL** tab for structured queries:

```
{ duration > 1s }                   # all spans slower than 1 second
{ name = "POST /workouts" }         # spans for a specific operation
{ .http.status_code = 500 }         # spans with a 500 status attribute
```

### From a log line

If you already have a log line in Loki with a `trace_id` field, click the `trace_id`
value — Grafana's derived-field link opens the matching Tempo trace directly.

---

## Jumping log ↔ trace

The `apps/api` logger (`nestjs-pino`) injects `trace_id` and `span_id` from the active
OpenTelemetry span into every structured log line. Grafana is pre-configured with
bidirectional links between Loki and Tempo.

### Log → trace

1. Open **Explore → Loki** datasource.
2. Run a LogQL query, e.g.: `{service_name="lifting-logbook-api"} |= "error"`
3. Expand any log line — the `trace_id` field appears as a clickable link.
4. Clicking the link opens the full trace in Tempo in a split view.

### Trace → log

1. Open a trace in Tempo (via Explore or the RED dashboard drill-down).
2. Click any span in the trace waterfall.
3. Click **Logs for this span** in the detail panel.
4. Grafana queries Loki filtered by `trace_id` and `span_id` and opens the matching
   log lines.

Both directions are wired via Grafana datasource provisioning in
[`infra/observability/grafana/provisioning/datasources/local.yml`](../../infra/observability/grafana/provisioning/datasources/local.yml).

---

## Alert silencing

### Alert rules

Three Prometheus alert rules are defined in
[`infra/observability/alerts/api.yaml`](../../infra/observability/alerts/api.yaml):

| Rule | Condition | Severity |
|---|---|---|
| `APIHighErrorRate` | 5xx rate > 1% over 5 minutes | warning |
| `APIHighP95Latency` | p95 latency > 1 s over 5 minutes | warning |
| `APINoRequests` | Zero requests for 10 minutes | info |

> **Known issue:** `APINoRequests` fires spuriously outside business hours because it
> has no `for:` grace period. This is a documented open item in ADR-018. Silence it
> during off-hours or add a time-based inhibition rule until the fix lands.

### Creating a silence

1. Open **Grafana → Alerting → Silences**.
2. Click **New silence**.
3. Set a **Matchers** entry: e.g., `alertname = APINoRequests`.
4. Set the **Duration** (e.g., 8h).
5. Add a **Comment** explaining why.
6. Click **Submit**.

The silence takes effect immediately and expires automatically at the specified time.

---

## Grafana Cloud credential wiring

The OTel Collector reads four environment variables to route telemetry to Grafana Cloud
in production. In local dev, leave these unset — the Collector sends to the local
Tempo and Loki containers instead.

| Variable | Purpose |
|---|---|
| `OTEL_COLLECTOR_OTLP_ENDPOINT` | Grafana Cloud Tempo/Mimir OTLP endpoint (traces + metrics) |
| `OTEL_COLLECTOR_LOKI_ENDPOINT` | Grafana Cloud Loki push endpoint (logs) |
| `OTEL_COLLECTOR_OTLP_AUTH_HEADER` | `Basic <base64(instanceId:apiKey)>` for traces/metrics |
| `OTEL_COLLECTOR_LOKI_AUTH_HEADER` | `Basic <base64(instanceId:apiKey)>` for logs |

Grafana Cloud endpoints and credentials are obtained from the Grafana Cloud portal:

- **Traces/metrics endpoint:** Stack → Details → OpenTelemetry → OTLP endpoint
- **Logs endpoint:** Stack → Details → Loki → URL (append `/loki/api/v1/push`)
- **API key:** Stack → Details → Generate a token (select "MetricsPublisher" or
  create a service account with Send metrics + Send traces + Send logs permissions)

### GKE production

Values are stored in a Kubernetes Secret named `otel-collector-auth` in the workload
namespace (keys: `otlp-auth-header`, `loki-auth-header`). The Helm chart reads them
automatically — see
[`infra/kubernetes/charts/otel-collector/templates/NOTES.txt`](../../infra/kubernetes/charts/otel-collector/templates/NOTES.txt)
for the bootstrap command.

Recommended path: External Secrets Operator pulling from GCP Secret Manager via
Workload Identity. To bootstrap manually:

```sh
kubectl create secret generic otel-collector-auth \
  --from-literal=otlp-auth-header="Basic <base64(instanceId:apiKey)>" \
  --from-literal=loki-auth-header="Basic <base64(instanceId:apiKey)>"
```

### Cloud Run (future)

A sidecar template exists at
[`infra/cloud-run/otel-collector-sidecar.yaml`](../../infra/cloud-run/otel-collector-sidecar.yaml).
Credentials are wired via Cloud Run Secret Manager volumes — see the file for details.

---

## On-call escalation

Severity levels, escalation paths, SLO targets, and incident response procedures are
documented in:

- [`docs/operations/on-call.md`](../operations/on-call.md) — severity levels, escalation paths, postmortem template
- [`docs/operations/slo.md`](../operations/slo.md) — SLO targets and error budget policy
- [`docs/runbooks/README.md`](README.md) — index of all failure-mode runbooks

---

## References

- [Grafana Tempo — search and query](https://grafana.com/docs/tempo/latest/tracing/tempo-search/) — TraceQL reference and search UI guide
- [Grafana Loki — log exploration](https://grafana.com/docs/loki/latest/visualize/grafana/) — LogQL syntax and Explore panel usage
- [OpenTelemetry Collector — environment variable substitution](https://opentelemetry.io/docs/collector/configuration/#environment-variables) — how `${env:VAR}` syntax works in collector config
