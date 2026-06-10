# Runbook: Staging CI Flakiness (staging.yml red runs)

**Triggers:** `staging.yml` runs go red/yellow on transient causes; re-running failed jobs goes
green; `Verify deploy prerequisites` fails with "deploy-api did not succeed"
**Default severity:** SEV3 — CI signal only; production is unaffected
**Dashboard:** GitHub Actions → Staging workflow runs

---

## Symptom

- A `staging.yml` run fails, but re-running the failed jobs (no code change) goes green.
- The `Staging Integration Tests → Verify deploy prerequisites` step errors with
  `deploy-api did not succeed (result: skipped|cancelled)`.
- The `Build & Push Images` job failed on `Build and push API/web image`.
- `Terraform apply (staging)` failed transiently.

## Likely causes

Ordered by observed probability (the [#498](https://github.com/brownm09/lifting-logbook/issues/498)
diagnosis, 2026-06-10):

1. **Artifact Registry 504 on layer-blob push** during `Build & Push Images`. This is the
   dominant driver. When the build job fails, `deploy-api` is skipped (`needs: build-images`), and
   the `Verify deploy prerequisites` guard then fails — the message talks about *deploy
   prerequisites*, but the true cause is one job upstream (the #395 misleading-error chain).
2. **Terraform apply transient** — a GCP API 5xx or eventual-consistency hiccup during
   `terraform apply (staging)`.
3. **Genuine failure** — a real build break, a real migration/schema error, or a real Terraform
   config error. These should *not* be re-run blindly; read the logs.

**NOT a likely cause: staging Cloud SQL connectivity.** The #498 diagnosis found the staging
Cloud SQL instance (`lifting-logbook-stg-db-913df97c`, `db-f1-micro`, ALWAYS-on, ZONAL,
private-IP) healthy: 0 migrate task-failures across 46 runs, all recent Cloud Run API revisions
healthy, and no connection-exhaustion / auth / connect-timeout errors in 7 days of Cloud SQL
logs. The historical `continue-on-error` on the migrate/deploy steps was added against this
*assumed* cause; the migrate step no longer tolerates failure (see Mitigations below).

## Diagnosis

1. Identify which job actually failed (not just the guard that reported it):
   ```bash
   gh run view <run-id> --json jobs \
     --jq '.jobs[] | select(.conclusion=="failure") | {name, steps: [.steps[] | select(.conclusion=="failure") | .name]}'
   ```
   If the failing job is `Build & Push Images` or `Terraform (staging)`, the prereq-guard failure
   is a downstream symptom, not the cause.
2. Confirm Cloud SQL is healthy before suspecting connectivity:
   ```bash
   # ERROR-severity Cloud SQL logs (should be empty / only schema-drift, not connect errors)
   gcloud logging read 'resource.type="cloudsql_database" AND resource.labels.database_id="lifting-logbook-staging:lifting-logbook-stg-db-913df97c" AND severity>=ERROR' \
     --project=lifting-logbook-staging --freshness=3d --limit=20 \
     --format="value(timestamp,severity,textPayload)"
   # Migrate job execution health (failedCount should be empty/0)
   gcloud run jobs executions list --job=lifting-logbook-stg-migrate \
     --region=us-central1 --project=lifting-logbook-staging \
     --format="table(metadata.name,status.succeededCount,status.failedCount)" --limit=15
   ```
3. For a build failure, open the `Build and push API/web image` step log and look for
   `5xx`/`504` on a layer-blob `PUT` to `*-docker.pkg.dev`.

## Remediation

The pipeline now self-heals the transient classes; manual action is the exception:

1. **AR build/push + Terraform apply** are wrapped in bounded retries
   (`Wandalen/wretry.action`, 3 attempts on the build steps; a 2-attempt shell loop on
   `terraform apply`). A single transient 504 no longer reds the run.
2. **Migrate** runs a bounded 3-attempt retry and then **hard-fails** — there is no longer a
   `continue-on-error` masking it. A red migrate step is a *genuine* migration/schema failure:
   read the step log, fix the migration (or `prisma migrate resolve` via
   `scripts/migrate-staging-db.sh`), do not blindly re-run.
3. If a transient still slips past the retries, re-run only the failed jobs:
   ```bash
   gh run rerun <run-id> --failed
   ```
4. If AR 504s become frequent/sustained (not transient), check Artifact Registry status and the
   repo's region health; consider raising the retry attempt limit as a stopgap.

## Escalation

- Sustained (non-transient) Artifact Registry failures → GCP support / status page; this is
  outside the repo's control.
- A genuine migration failure that blocks staging → follow [ADR-027](../adr/ADR-027-deploy-pipeline-migrations.md)
  recovery (forward-only; `prisma migrate resolve` for a failed row).
- If Cloud SQL connectivity *does* start failing (contradicting the #498 diagnosis), reopen #498
  with the new `gcloud logging` evidence and re-evaluate connector / tier provisioning.
