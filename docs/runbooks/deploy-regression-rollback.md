# Runbook: Deploy Regression Rollback

**Triggers:** Error rate spike in Grafana that starts immediately after a recent deployment;
`APIHighErrorRate` alert correlated with a `kubectl rollout history` entry in the last 60 minutes
**Default severity:** SEV2 — escalate to SEV1 if error rate exceeds 10% or if data integrity
is at risk
**Dashboard:** Grafana → Lifting Logbook → API RED → Error Rate panel

---

## Symptom

- `APIHighErrorRate` alert fires shortly after a deploy
- The Error Rate panel in API RED shows a sharp step-change (not a gradual drift) at a
  time that matches a recent `kubectl rollout` event
- New errors appear in structured logs that were not present before the deploy
- Traces show failures in code paths touched by the recent change

---

## Likely causes

1. **Code bug introduced by the deploy** — a regression in the new image causes requests
   to fail on a code path that was not covered by tests.
2. **Missing or changed environment variable** — the new version expects an env var that
   is not set, or an existing var was renamed.
3. **Schema migration applied incorrectly** — a Prisma migration ran against the database
   and is incompatible with the running application version.
4. **Dependency version conflict** — a new `node_modules` dependency has a breaking change
   or is incompatible with an existing package.

---

## Diagnosis

### 1. Confirm the deploy timing

```sh
kubectl rollout history deployment/api
```

Find the most recent revision number and the timestamp. Compare to when the error rate
spiked in Grafana.

### 2. Check what changed

```sh
kubectl rollout history deployment/api --revision=<latest-revision>
```

Note the image tag. In the GitHub repository, find the commit corresponding to that tag.

**Faster alternative:** `bash scripts/check-deployed-version.sh` curls each service's
`/version` endpoint directly and prints `git log -1` context for the returned SHA in one step,
skipping the manual `kubectl rollout history` + tag lookup. See
[`checking-deployed-version.md`](checking-deployed-version.md).

### 3. Identify the failing code path

In Grafana Explore → Tempo:

```
{ .http.status_code >= 500 }
```

Open a failing trace and read `exception.message` and `exception.stacktrace` to identify
which function is throwing.

In Grafana Explore → Loki:

```logql
{service_name="lifting-logbook-api"} |= "error" | json
```

### 4. Verify there are no pending migrations

A migration that already ran cannot be rolled back by reverting the deployment alone —
the schema change is in the database. Check whether the deploy included a migration:

```sh
git log <previous-tag>..<current-tag> -- apps/api/prisma/migrations/
```

If migrations were included, proceed with caution and escalate before rolling back.

---

## Remediation

### Fast path: rollback the deployment

If no schema migrations were included and the root cause is a code bug, roll back
immediately:

```sh
kubectl rollout undo deployment/api
```

Wait for the rollback to complete:

```sh
kubectl rollout status deployment/api
```

Verify the error rate drops in Grafana within 2 minutes of the rollback completing. If
it does not drop, the rollback did not revert the cause — investigate further.

### If migrations were applied

Do not roll back the deployment until the impact of the migration is understood:

1. Escalate to the engineering lead immediately.
2. Check whether the previous application version is compatible with the current schema
   (i.e., is the migration additive-only, or did it drop or alter columns?).
3. If the migration is additive-only (new table or new nullable column), rolling back
   the deployment is safe — the old code will ignore the new schema.
4. If the migration altered or dropped columns, do not roll back without first writing a
   compensating migration. Rolling back the code without rolling back the schema will
   cause the old code to fail against the new schema.

### If the rollback resolves the issue

1. Verify the error rate is below the alert threshold for at least 10 minutes.
2. Resolve the alert in Grafana.
3. Open a GitHub issue on the specific regression with the failing trace attached.
4. Do not re-deploy the broken version. Fix the regression in a new branch and re-deploy.

---

## Escalation

If the rollback does not resolve the error rate, or if the deploy included migrations:

1. Escalate to SEV1 and loop in the engineering lead.
2. Share:
   - The diff between the previous and current image tag (`git log`)
   - The failing trace from Grafana Tempo
   - Whether migrations were applied
3. Do not attempt to manually edit the database without explicit guidance.
