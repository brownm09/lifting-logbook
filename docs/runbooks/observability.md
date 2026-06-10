# Observability Runbook

> **New here?** Start with the [Observability & On-Call onboarding guide](../operations/observability-onboarding.md)
> for a guided reading path; this runbook is the mechanics it links to.

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

## Alerting

### Alert rules

Four Prometheus alert rules are defined in
[`infra/observability/alerts/api.yaml`](../../infra/observability/alerts/api.yaml). **All four are
scoped to production** via the `deployment_environment_name="production"` label — staging and
production share one free-tier Grafana Cloud stack, so without scoping a staging 5xx would page on
the prod rules ([#487](https://github.com/brownm09/lifting-logbook/issues/487); see the
environment-scoping note under [Grafana Cloud credential wiring](#grafana-cloud-credential-wiring)).

| Rule | Condition (production only) | Severity |
|---|---|---|
| `APIRouteHighErrorRate` | any single route's 5xx rate > 5% over 5 minutes (grouped `by (http_route)`) | critical |
| `APIHighErrorRate` | API-wide 5xx rate > 1% over 5 minutes | warning |
| `APIHighP95Latency` | p95 latency > 1 s over 5 minutes | warning |
| `APINoRequests` | Zero production requests for 10 minutes | info |

`APIRouteHighErrorRate` exists because the API-wide `APIHighErrorRate` can stay below 1% when a
single endpoint fails at 100% but carries little traffic — the exact shape of the #458/#460
outage, which ran undetected for four days. The per-route rule trips on any one route's
sustained 5xx regardless of overall volume. See
[api-5xx-surge.md](api-5xx-surge.md) for first response. Its `> 5%` threshold, `for: 5m` window,
and whether to add a low-traffic volume floor are calibrated against production metrics using the
queries in [slo.md → Calibrating `APIRouteHighErrorRate`](../operations/slo.md#calibrating-apiroutehigherrorrate)
([#468](https://github.com/brownm09/lifting-logbook/issues/468)).

> **Known issue:** `APINoRequests` fires spuriously outside business hours because it
> has no `for:` grace period. This is a documented open item in ADR-018. The Alertmanager
> route (below) holds `severity=info` back from paging; you can also silence it during
> off-hours.

### Notification routing

Firing rules are routed to notification channels by the Alertmanager config in
[`infra/observability/alertmanager.yaml`](../../infra/observability/alertmanager.yaml). Without
this, the rules above would evaluate but page no one — the gap that let the #458 outage run
silently (#462).

| Aspect | Behaviour |
|---|---|
| Channels | **email + Slack** (`oncall` receiver), both with `send_resolved` |
| What pages | `severity =~ "warning|critical"` |
| What is held back | `severity = "info"` (e.g. `APINoRequests`) → `null` receiver, visible in the Alertmanager UI but no page |
| De-duplication | a route-level `APIRouteHighErrorRate` critical inhibits the redundant aggregate `APIHighErrorRate` warning for the same incident |
| Grouping | `by (alertname, http_route)` so distinct failing routes page separately |

The email address, SMTP credentials, and Slack webhook URL are **secrets** — they are never
committed. The file carries clearly-marked `.invalid` / `PLACEHOLDER` values; the real
destinations live in the Grafana Cloud Alertmanager (apply/update procedure:
[`docs/operations/slo.md`](../operations/slo.md#applying-alert-config-to-grafana-cloud)).
Locally, `docker compose up` starts an Alertmanager at <http://localhost:9093> so the
rule → route → receiver path is exercisable (delivery fails without real creds, which is
expected).

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

### GKE production (wired — #474)

The collector DaemonSet is deployed automatically by the deploy pipeline; there is no
manual `helm install` step. On every push-to-main deploy, `.github/workflows/deploy.yml`:

1. **Syncs the auth headers** — reads `lifting-logbook-{stg,prod}-otel-otlp-auth-header`
   and `-otel-loki-auth-header` from GCP Secret Manager (the CI/CD SA has `roles/owner`)
   and writes them into a Kubernetes Secret named **`otel-collector-secrets`** (keys
   `otlp-auth-header`, `loki-auth-header`) in the workload namespace. The chart's
   `daemonset.yaml` reads that Secret via `secretKeyRef`. The step fails the deploy
   loudly — and never echoes the value — if either secret is absent, empty, or the
   unpopulated `REPLACE_ME` sentinel.
2. **Helm-deploys the collector** — `helm upgrade --install otel-collector` with the
   per-env values file (`infra/kubernetes/values/{staging,production}-otel-collector.yaml`),
   which sets the non-secret OTLP/Loki endpoints.

**One-time token bootstrap** (the only manual step, run once per env): run
[`scripts/bootstrap-otel-secrets.sh`](../../scripts/bootstrap-otel-secrets.sh) — it creates
the Secret Manager containers (not Terraform-managed) and populates the real Grafana token.
See [`docs/deploy.md` → OTel Collector / Grafana Cloud telemetry](../deploy.md#otel-collector--grafana-cloud-telemetry).

**Metrics → Mimir:** the collector ships metrics over the **same OTLP gateway** as traces
(the gateway fans metrics out to Mimir), reusing the OTLP auth header. The chart's metrics
pipeline uses the `otlphttp/metrics` exporter — **not** a `:8889` Prometheus scrape, which
nothing scrapes in GKE. This is the path `APIRouteHighErrorRate` depends on. (The local
docker-compose collector keeps the `prometheus`/`:8889` exporter, which the local
Prometheus container scrapes.)

> **Shared stack (free tier) — environment scoping:** staging and production export to the
> **same** Grafana Cloud stack with the same endpoints/token, so telemetry from both environments
> intermixes in Tempo/Loki/Mimir. To keep staging from paging the production alert rules
> ([#487](https://github.com/brownm09/lifting-logbook/issues/487)):
>
> 1. The API and web SDKs tag every span/metric/log with the
>    [`deployment.environment.name`](https://opentelemetry.io/docs/specs/semconv/resource/deployment-environment/)
>    resource attribute, sourced from `NODE_ENV` (`production` / `staging`; `development` locally).
>    See [`apps/api/src/otel.ts`](../../apps/api/src/otel.ts) and
>    [`apps/web/instrumentation.ts`](../../apps/web/instrumentation.ts).
> 2. Resource attributes do **not** become per-series Prometheus labels on their own (OTLP→Prom
>    puts them on `target_info`). The collector's `transform/env_label` processor promotes the
>    attribute to a `deployment_environment_name` metric label in the **metrics** pipeline
>    ([`configmap.yaml`](../../infra/kubernetes/charts/otel-collector/templates/configmap.yaml));
>    traces/logs keep the resource attribute natively in Tempo/Loki for filtering.
> 3. All four `api.yaml` alert rules match `deployment_environment_name="production"`, so a staging
>    5xx never pages. `infra/observability/alerts/api.test.yaml` locks this with a
>    staging-does-not-page scenario.

### Cloud Run (deferred)

The A/B Cloud Run replica does not yet ship telemetry. A sidecar template exists at
[`infra/cloud-run/otel-collector-sidecar.yaml`](../../infra/cloud-run/otel-collector-sidecar.yaml),
but wiring it safely against the Terraform-owned service is tracked as a follow-up to #474.
GKE (the primary topology per [ADR-018](../adr/ADR-018-observability-stack.md)) carries the
bulk of traffic and is fully wired.

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
- [Prometheus — Alertmanager configuration](https://prometheus.io/docs/alerting/latest/configuration/) — the routing tree, receivers, and inhibit-rule syntax used in `infra/observability/alertmanager.yaml`
- [Prometheus — Alerting rules](https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/) — the `groups`/`rules` syntax used in `infra/observability/alerts/api.yaml`
