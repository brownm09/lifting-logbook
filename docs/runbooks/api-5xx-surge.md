# Runbook: API 5xx Surge

**Triggers:**
- `APIRouteHighErrorRate` (severity **critical**) — a single route's 5xx rate > 5% for 5
  minutes. This is the primary signal for a *one-endpoint* failure: it fires even when the
  broken route carries only a small share of total traffic, so the API-wide ratio stays low.
  It is the alert that would have caught the #458/#460 outage (`GET /programs/:program/lifts`
  returned 500 on every call for four days while overall traffic was modest and the aggregate
  rate never crossed 1%). The firing alert's `http_route` label names the failing endpoint —
  start diagnosis there.
- `APIHighErrorRate` (severity **warning**) — API-wide 5xx rate > 1% for 5 minutes; the signal
  for a broad degradation hitting many routes at once.
- Also the starting point for `APIHighP95Latency` — check the Latency panel alongside the
  Error Rate panel.

**Notification:** these alerts route through the Alertmanager config in
[`infra/observability/alertmanager.yaml`](../../infra/observability/alertmanager.yaml) to the
on-call **email + Slack** channels (warning/critical only; `APINoRequests`/info is held back
from paging). If an alert fired but no page arrived, verify the Grafana Cloud Alertmanager
contact points per [`docs/operations/slo.md`](../operations/slo.md#applying-alert-config-to-grafana-cloud).

**Default severity:** SEV2 — escalate to SEV1 if error rate exceeds 10% for > 5 minutes
**Dashboard:** Grafana → Lifting Logbook → API RED → Error Rate panel and Latency panel

---

## Symptom

- `APIRouteHighErrorRate` or `APIHighErrorRate` alert fires in Grafana Alerting and pages via
  email + Slack
- The Error Rate panel in the API RED dashboard shows a spike above the threshold (filter by
  the `http_route` from the alert label for a single-endpoint failure)
- Users report errors or the application appears broken

---

## Likely causes

1. **Code regression from a recent deploy** — a bad deployment introduced a bug that causes
   requests to fail. Check whether a deploy happened in the last 30–60 minutes.
2. **Database connectivity failure** — Prisma cannot reach Postgres; all DB-backed endpoints
   return 500. See [database-unreachable.md](database-unreachable.md).
3. **Auth provider degradation** — Clerk is returning errors, causing request validation to
   fail. Check [auth-provider-outage.md](auth-provider-outage.md).
4. **Memory or resource exhaustion** — the API pod is OOMKilled or hitting CPU limits,
   causing intermittent 503s from Kubernetes.
5. **Misconfigured environment variable** — a missing or invalid env var causes
   initialisation to fail on a particular code path.

---

## Diagnosis

### 1. Check the dashboard

Open Grafana → Lifting Logbook → API RED. Note:
- Is the error rate rising, stable, or recovering?
- Is the request rate also changing (a traffic spike can amplify a latent bug)?
- Did the error rate start abruptly (deploy) or gradually (resource exhaustion)?

### 2. Find error traces

In Grafana Explore → Tempo, run a TraceQL query to find 5xx spans:

```
{ .http.status_code >= 500 }
```

Open a span and read the `exception.message` and `exception.stacktrace` attributes.

### 3. Tail error logs

In Grafana Explore → Loki:

```logql
{service_name="lifting-logbook-api"} |= "error" | json
```

Look for a repeated error message, stack trace, or status code that identifies the
failing code path.

### 4. Check for a recent deploy

```sh
kubectl rollout history deployment/api
```

If a deploy happened in the last 60 minutes and the error started around the same time,
follow [deploy-regression-rollback.md](deploy-regression-rollback.md).

### 5. Check pod health

```sh
kubectl get pods -l app=api
kubectl describe pod <pod-name>
```

Look for `OOMKilled`, `CrashLoopBackOff`, or failed readiness probes.

---

## Remediation

1. **If a recent deploy is the cause:** roll back immediately using
   [deploy-regression-rollback.md](deploy-regression-rollback.md).
2. **If the database is unreachable:** follow [database-unreachable.md](database-unreachable.md).
3. **If the auth provider is failing:** follow [auth-provider-outage.md](auth-provider-outage.md).
4. **If the pod is OOMKilled:** temporarily increase the memory limit in the Helm values file
   (`infra/kubernetes/charts/api/values.yaml`) and redeploy. Open a GitHub issue to
   investigate root cause.
5. **If the cause is unclear and the error rate is still rising:** restart the API deployment
   as a last resort. This may resolve transient issues and buys time to diagnose:
   ```sh
   kubectl rollout restart deployment/api
   ```
   Confirm the error rate drops within 2 minutes of the restart completing.

---

## Escalation

If the error rate does not improve after working through this runbook:

1. Escalate to SEV1 and loop in the engineering lead.
2. Capture the failing TraceQL and LogQL queries and the error messages you found.
3. Check GCP Status (status.cloud.google.com) and Clerk Status (status.clerk.com) for
   ongoing incidents before assuming the issue is internal.
