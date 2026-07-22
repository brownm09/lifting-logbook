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

Ordered by observed probability (the [#498](https://github.com/merickvaughn/lifting-logbook/issues/498)
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
   `terraform apply`). A single transient 504 no longer reds the run. The same hardening was
   applied to `deploy.yml` (the push-to-`main` prod + staging-promote pipeline) for parity
   ([#504](https://github.com/merickvaughn/lifting-logbook/issues/504)) — including bounded retries on
   the two `terraform apply` steps and every `docker/build-push-action` build. The latter now
   includes the two direct prod-AR build-pushes that replaced the former `imagetools`
   staging-AR→prod-AR copies ([#397](https://github.com/merickvaughn/lifting-logbook/issues/397) /
   [ADR-029](../adr/ADR-029-per-env-artifact-registry-push.md)); they are exposed to the same
   transient AR 504s and carry the same 3-attempt retry.
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

## No-timeout job hang (6-hour default)

A distinct failure class from the transient build/Terraform causes above: a job **wedges with
no progress** and, lacking a `timeout-minutes`, runs until GitHub's **6-hour default** cancels
it (or someone force-cancels it manually).

- **Symptom:** a single job (e.g. `Staging Integration Tests`) shows as running for *hours* with
  the live log stalled on one step — commonly a network-bound step like
  `npx playwright install --with-deps chromium` (~6.5 min when healthy) or an image pull. The
  rest of the run is otherwise normal; re-running goes green.
- **Cause:** a runner-level wedge (a hung apt/network fetch, a stuck process), **not** a code or
  config failure. The 6h fallback applies to any job with no explicit `timeout-minutes`.
- **Mitigation (in place):** every job in `staging.yml`, `ci.yml`, and `deploy.yml` now sets an
  explicit `timeout-minutes` sized to ~2–4× its normal runtime (see [#566](https://github.com/merickvaughn/lifting-logbook/issues/566)).
  A wedge now auto-cancels in minutes instead of consuming a 6h slot. If you add a **new** job to
  any of these workflows, give it a `timeout-minutes` too.
- **If it recurs anyway:** cancel the run, then `gh run rerun <run-id> --failed`. If the same
  step wedges repeatedly (not a one-off), investigate that step's network dependency rather than
  raising the timeout.

**Motivating incident:** 2026-06-18, PR #562 run `27772616067` — the `staging-integration-tests`
job (then with no `timeout-minutes`) wedged on the Playwright `--with-deps` install and ran 3+
hours before being force-cancelled.

## Hollow green — deploy-api reports success but nothing deployed

A failure class specific to the `deploy-api` Cloud Run sidecar deploy. That step carries
`continue-on-error: true` on purpose ([#498](https://github.com/merickvaughn/lifting-logbook/issues/498)):
a *revision* that fails to start must still let the `Fetch Cloud Run API logs on failure` step run,
and the integration-test gate — not the deploy step — fails the run. Since
[#822](https://github.com/merickvaughn/lifting-logbook/pull/822) moved the deploy to
`uses: ./.github/actions/deploy-cloud-run-otel-sidecar`, a new outcome became maskable: the
composite action can fail to **load** (a manifest/template-validation error), which
`continue-on-error` also swallows — so `deploy-api` shows a green ✓ while **no revision was
submitted** and the stale revision keeps serving. Integration tests then run against old code and
the green propagates undetected ([#823](https://github.com/merickvaughn/lifting-logbook/issues/823); it
happened on #822's first CI run, an `env.REGION`-in-an-input-description bug in `action.yml`).

- **Symptom:** the `Verify API revision actually deployed (staging)` step in `Deploy API (staging)`
  errors with `::error title=Staging API deploy is a hollow green::…` (or `…unverifiable…`). That
  step is the mitigation: it runs only when the deploy claimed success (`outcome == 'success'`),
  re-derives the live service's image from Cloud Run, and hard-fails when it is **not** the
  just-built `…/api:<image_tag>`. So a hollow green now reds `deploy-api` directly instead of
  slipping through to a stale-image test pass.
- **Cause:** a structural error in `.github/actions/deploy-cloud-run-otel-sidecar/action.yml` (the
  manifest fails template validation, so none of the action's steps run) — **not** GCP flakiness.
  The classic trigger is a `${{ … }}` expression in an input *description* (GitHub evaluates those
  at action-load time, where `env`/`secrets`/`needs` are not available named-values).
- **Diagnosis:** open the failing step's log — it prints the expected vs. the live image. Then
  validate the action manifest locally:
  ```bash
  python3 -c "import yaml,sys; yaml.safe_load(open('.github/actions/deploy-cloud-run-otel-sidecar/action.yml')); print('action.yml parses')"
  # and confirm no ${{ }} appears inside any input description:
  grep -nE '^\s+description:.*\$\{\{' .github/actions/deploy-cloud-run-otel-sidecar/action.yml
  ```
- **Fix:** correct the `action.yml` manifest (remove the offending expression / structural error),
  push, and re-run. This is a **genuine failure** — do not blindly re-run without fixing the
  manifest; the same load error recurs every run until the file is fixed.

## Escalation

- Sustained (non-transient) Artifact Registry failures → GCP support / status page; this is
  outside the repo's control.
- A genuine migration failure that blocks staging → follow [ADR-027](../adr/ADR-027-deploy-pipeline-migrations.md)
  recovery (forward-only; `prisma migrate resolve` for a failed row).
- If Cloud SQL connectivity *does* start failing (contradicting the #498 diagnosis), reopen #498
  with the new `gcloud logging` evidence and re-evaluate connector / tier provisioning.
