# ADR-027: Database Migrations via In-VPC Cloud Run Job in the Deploy Pipeline

**Status:** Accepted
**Date:** 2026-06-08
**Closes:** [#460](https://github.com/merickvaughn/lifting-logbook/issues/460)
**Related:** [#458](https://github.com/merickvaughn/lifting-logbook/issues/458) / [#459](https://github.com/merickvaughn/lifting-logbook/pull/459) (the onboarding lift-catalog symptom this fixes at the root), [ADR-009](ADR-009-infrastructure-kubernetes-cloud-run.md) (Cloud Run / Cloud SQL / Terraform infrastructure), [ADR-010](ADR-010-multi-tenancy-data-isolation.md) (single shared schema, `user_id`-scoped), [ADR-024](ADR-024-prisma-otel-sdk-override.md) (Prisma runtime engine on Alpine — the same image this job reuses)

---

## Context

Production schema migrations were never applied by the deploy pipeline. `npx prisma migrate
deploy` appeared in exactly one place — `.github/workflows/ci.yml`, run against the ephemeral
CI test database (Postgres service container). Neither `deploy.yml` (the push-to-`main`
pipeline that deploys staging and production) nor `staging.yml` (the per-PR staging pipeline)
ran migrations against the deployed database.

The consequence surfaced as [#458](https://github.com/merickvaughn/lifting-logbook/issues/458): the
onboarding lift-catalog picker appeared broken in production. The root cause (confirmed in prod
logs while merging [#459](https://github.com/merickvaughn/lifting-logbook/pull/459)) was that
`GET /programs/:program/lifts` returned HTTP 500 on every request because the `custom_lift`
table did not exist in the production database. The migration that creates it
(`20260603000000_add_custom_lift`, plus the follow-up `20260603120000_add_movement_profile`)
shipped to the repo and the API code depended on it, but the table was never created in prod —
errors began the day after the migration was added and recurred for days. Staging masked the
gap because its database is re-provisioned by Terraform on each PR deploy, so it never
accumulated drift.

This is a systemic data-integrity / deploy risk, not a one-off: **every future migration was a
latent production outage** until the pipeline gap was closed.

### The hard constraint: a private-IP-only database

The Cloud SQL instance has **no public IP**. It is reachable only over the VPC, via private
service access, from the serverless VPC Access connector that the API Cloud Run service uses
(`infra/terraform/main.tf` `ip_configuration { ipv4_enabled = false; private_network = ... }`,
`infra/terraform/cloud-run.tf` `google_vpc_access_connector.main`). The `DATABASE_URL` secret
points at the instance's `private_ip_address`.

A GitHub-hosted runner is not on the VPC, so it **cannot** run `prisma migrate deploy` against
the database directly — not even through the Cloud SQL Auth Proxy, which for a private-IP-only
instance still requires the client host to have network reachability to the private IP. The
break-glass script `scripts/migrate-prod-db.sh` works around this for local/manual use by
*temporarily* enabling a public IP scoped to the operator's IP, but doing that on every deploy
is an unacceptable recurring exposure.

## Decision

**Run migrations from inside the VPC, as a dedicated Cloud Run Job, executed by the deploy
pipeline before the new API revision goes live.**

1. **Terraform** (`infra/terraform/cloud-run.tf`) defines `google_cloud_run_v2_job.migrate`
   (`${name_prefix}-migrate`, created per workspace so one resource covers staging and prod):
   - reuses the **API container image** — it already ships the Prisma CLI, `@prisma/engines`,
     and the migration SQL under `apps/api/prisma`;
   - overrides the entrypoint to `/bin/sh -c "npx prisma migrate deploy --schema=prisma/schema.prisma && npx prisma migrate status --schema=prisma/schema.prisma"`;
   - runs as the **API workload service account** (`api_workload`), which already holds
     `roles/cloudsql.client` and `roles/secretmanager.secretAccessor` — **no new IAM**;
   - attaches the **same VPC connector** (`PRIVATE_RANGES_ONLY` egress) and reads
     `DATABASE_URL` from the same Secret Manager secret as the API service;
   - sets `max_retries = 0` (a half-applied migration must not be silently retried).
2. **The deploy pipeline** (`deploy.yml` `deploy-production` + `deploy-staging`, and
   `staging.yml` `deploy-api`) runs, after `terraform apply` and before the API service deploy:
   ```
   gcloud run jobs update <job> --image=<api:sha>   # set the real image (Terraform applies a placeholder)
   gcloud run jobs execute <job> --wait             # run it; non-zero exit fails the deploy
   ```
3. **Drift guard:** the `&& prisma migrate status` clause asserts a clean end-state. With
   `--wait`, a failed `migrate deploy` *or* a non-empty pending set fails the job → fails the
   deploy → the last-good API revision keeps serving. Scope note: `migrate status` detects
   *migration-state* drift (unapplied or failed migrations), **not** arbitrary out-of-band
   schema changes (that would require `migrate diff`); "drift guard" here means the former.

Terraform's `lifecycle.ignore_changes` on the job targets **only** the container image (and the
gcloud-set `client`/`client_version`), so the command, env, SA, and VPC config stay
Terraform-managed and changeable via a normal apply — unlike the services, which ignore the
whole `template` because `gcloud run deploy` mutates many fields.

The manual `scripts/migrate-prod-db.sh` / `migrate-staging-db.sh` are retained as the
break-glass / first-time-bootstrap path, not the steady-state mechanism.

## Rationale

- **It satisfies the private-IP constraint without recurring exposure.** The job runs inside
  the VPC over the existing connector. No public IP is ever enabled during a deploy; the DB
  stays private. This is the GCP-recommended pattern for running schema migrations against a
  private Cloud SQL instance from CI/CD.
- **It reuses the artifact that already works.** The API image is built, tested, and known to
  resolve Prisma's Alpine (`linux-musl`) engines at runtime (the API itself runs on it). Using
  it for migrations means the migration runs against the *exact* Prisma version and schema that
  the deploying revision expects — no separate migration image to keep in sync.
- **Least privilege, no new surface.** Reusing `api_workload` (already DB- and secret-scoped)
  and the CICD owner SA (which already deploys services) means zero new IAM bindings and zero
  new secrets to manage.
- **Fail-safe ordering.** Migrations run *before* the API revision serves traffic. A failed
  migration halts the deploy with the previous (working) revision still live, rather than
  shipping code that expects a schema that isn't there — the exact failure mode of #458,
  inverted into a safe stop.

## Consequences

**Positive:**
- Adding a migration to the repo is now safe: the next deploy applies it. The class of "latent
  prod outage on every migration" is closed.
- Paired with a **post-deploy DB-backed readiness smoke** (`GET /readyz` → `SELECT 1`, probed
  with a Cloud Run identity token in `deploy-production`): `migrate status` guards schema
  *completeness* before deploy; `/readyz` guards that the live revision can actually *serve* DB
  requests after deploy. Together they close the #458 gap from both ends — previously no prod
  smoke hit a DB-backed endpoint at all. (`/readyz` does not auto-roll-back; that is a tracked
  follow-up.)
- Staging exercises the same migrate path as prod (rather than relying on Terraform
  re-provisioning to hide drift), so a broken migration is caught on the PR's staging pipeline
  before merge.
- The migration mechanism is in IaC + version-controlled workflow YAML, reviewable like any
  other change.

**Negative / accepted:**
- **Forward-only.** `prisma migrate deploy` never rolls back. A bad migration that *succeeds*
  but is wrong requires a new corrective ("down") migration; a migration that *fails* leaves a
  failed row in `_prisma_migrations` that must be resolved with `prisma migrate resolve` (via
  the break-glass script) before the next deploy can proceed. This is inherent to Prisma's
  production model, not specific to this design.
- **~30–60s added per deploy** for the job execution. Negligible.
- **First execution must be observed.** The job's first real run applies the backlog
  (`add_custom_lift`, `add_movement_profile`) to prod; its logs (Cloud Logging, Cloud Run Job
  execution) should be checked to confirm the Alpine schema-engine resolves and the apply
  succeeds. Subsequent runs are no-ops when the schema is current.

## Alternatives considered

- **Temporary public IP in the workflow** (mirror `migrate-prod-db.sh` in CI). Rejected: it
  exposes the production DB publicly on every deploy (even scoped to the runner's ephemeral IP),
  adds minutes of `gcloud sql instances patch` time each way, and needs `cloudsql.instances.update`
  on the CICD identity. Acceptable for a rare manual operation, not for the steady-state path.
- **Migrate on API container startup.** Rejected: multiple Cloud Run instances would race the
  migration on cold start, startup-time DDL failures are harder to reason about than a discrete
  job, and a failed migration would crash-loop the revision instead of cleanly halting the
  deploy.
- **Self-hosted runner on the VPC.** Rejected: a standing runner is far more operational
  surface than a per-deploy job for a single-maintainer project.

## Addendum — 2026-06-10: staging migrate `continue-on-error` removed (#498)

When this ADR shipped, the staging pipeline's `Run database migrations (staging)` step (and the
Cloud Run API deploy step) carried `continue-on-error: true`, justified as tolerating
"intermittent staging Cloud SQL connectivity flakiness", with the Staging Integration Tests as
the authoritative gate. [#498](https://github.com/merickvaughn/lifting-logbook/issues/498) was filed
to track that untracked root cause.

A read-only GCP diagnosis (gcloud telemetry, 2026-06-10) **did not corroborate the Cloud SQL
premise**: 0 migrate task-failures across the last 46 executions, all recent Cloud Run API
revisions healthy, and no connection-exhaustion / auth / connect-timeout errors in the staging
Cloud SQL logs over 7 days. The only DB-side error class observed was schema drift
(`relation "public.custom_lift" does not exist`) — precisely the failure mode the migrate
`continue-on-error` could **mask**. The genuine staging red-run driver was upstream: transient
Artifact Registry 504s on image push and Terraform apply transients (the #395 misleading-error
chain through the `Verify deploy prerequisites` guard).

**Change:** the migrate step's `continue-on-error` is **removed**. A bounded 3-attempt retry now
absorbs the rare transient blip (`prisma migrate deploy` is idempotent), and a genuine
migration/schema failure **hard-fails the deploy** rather than being swallowed — restoring the
fail-safe ordering this ADR's Decision intended. The "Surface swallowed migration failure" step
is removed (nothing is swallowed now). Bounded retries were also added to the real driver (AR
build/push, Terraform apply). The Cloud Run API deploy step keeps `continue-on-error` solely so
its log-fetch step can capture a crash reason; the integration-test gate still fails the run.
Full evidence and re-triage guidance: [`docs/runbooks/staging-ci-flakiness.md`](../runbooks/staging-ci-flakiness.md).

## References

- [Prisma — Deploying database changes with Prisma Migrate](https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production#production-and-testing-environments) — establishes `prisma migrate deploy` as the production/CI command (applies pending migrations, never resets, no prompts); the basis for the job's command.
- [Prisma — CLI reference: `migrate status`](https://www.prisma.io/docs/orm/reference/prisma-cli-reference#migrate-status) — exit-code semantics used as the deploy-time drift guard.
- [Prisma — `migrate resolve` (production troubleshooting)](https://www.prisma.io/docs/orm/prisma-migrate/workflows/patching-and-hotfixing#fixing-failed-migrations-with-migrate-resolve) — the recovery path for a failed migration referenced under Consequences.
- [Google Cloud — Create and execute Cloud Run jobs](https://cloud.google.com/run/docs/create-jobs) — the job resource and `gcloud run jobs execute --wait` semantics.
- [Google Cloud — Connect from Cloud Run to Cloud SQL using private IP](https://cloud.google.com/sql/docs/postgres/connect-run#private-ip) — the in-VPC connectivity model this job depends on.
- [Google Cloud — Configure Serverless VPC Access](https://cloud.google.com/vpc/docs/configure-serverless-vpc-access) — the connector that gives the job a route to the database's private IP.
- [Google Cloud — Configure private IP for Cloud SQL](https://cloud.google.com/sql/docs/postgres/configure-private-ip) — why a GitHub-hosted runner cannot reach the instance directly (the constraint driving this decision).
