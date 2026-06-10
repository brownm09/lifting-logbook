# scripts/

Repository automation scripts. Grouped by lifecycle.

## Local development setup

| Script | Purpose |
|---|---|
| [`dev-setup.sh`](dev-setup.sh) | One-shot local bootstrap: installs Node deps, validates `.nvmrc`, sets up env files for `apps/api` and `apps/web`. Run after cloning. |

## Production deploy

| Script | Purpose |
|---|---|
| [`bootstrap-gcp.sh`](bootstrap-gcp.sh) | One-time GCP bootstrap for a lifting-logbook deploy (prod or staging): creates the project, links billing, enables the APIs Terraform needs, and provisions the Terraform state bucket. Idempotent. Pass `--project-id lifting-logbook-staging` to bootstrap the staging environment. See [`docs/deploy-single-user.md`](../docs/deploy-single-user.md) and [`docs/staging-runbook.md`](../docs/staging-runbook.md). |
| [`bootstrap-otel-secrets.sh`](bootstrap-otel-secrets.sh) | One-time Grafana Cloud auth-header bootstrap for the OTel Collector (#474): prompts for the OTLP/Loki instance IDs + an API token (token prompt hidden), builds the `Basic base64(instanceId:token)` headers locally, and creates+populates the `lifting-logbook-{stg,prod}-otel-{otlp,loki}-auth-header` Secret Manager secrets the deploy pipeline reads. Idempotent (adds a new version on re-run); the secrets are **not** Terraform-managed. Pass `--env staging`/`--env production` to scope to one environment. See [`docs/deploy.md`](../docs/deploy.md#otel-collector--grafana-cloud-telemetry). |
| [`deploy-prod-infra.sh`](deploy-prod-infra.sh) | Automates `terraform init` → workspace select → `apply` for the production environment. Maps custom domains and prints GitHub Actions secrets. Use `--plan-only` to preview. Run after `bootstrap-gcp.sh`. |
| [`migrate-prod-db.sh`](migrate-prod-db.sh) | Applies all database migrations to the production Cloud SQL instance. Temporarily enables a public IP, runs Prisma migrations and the `user_data_source` infra migration via the Cloud SQL Auth Proxy, then removes the public IP. Downloads the proxy automatically. |
| [`migrate-staging-db.sh`](migrate-staging-db.sh) | Applies all database migrations to the staging Cloud SQL instance. Staging-specific variant of `migrate-prod-db.sh`: uses the shared `lifting-logbook-tfstate` state bucket (prefix `terraform/state`), the `-stg-` secret naming pattern, `PROXY_PORT=5434`, and forces `sslmode=disable` on the proxy URL for Prisma compatibility. |

## Repository / project management

| Script | Purpose |
|---|---|
| [`create-github-project.sh`](create-github-project.sh) | Creates and configures the GitHub Project (v2) — fields, options, links repo, seeds Foundation issues. Run once per fresh fork. |
| [`create-foundation-issues.sh`](create-foundation-issues.sh) | Creates labels, the `v0.1 — Foundation` milestone, and the 17 Foundation issues. Run from the target repo root. |

## Build helpers (Apps Script legacy / build pipeline)

| Script | Purpose |
|---|---|
| [`check-clasp-login.js`](check-clasp-login.js) | Verifies `clasp` (Google Apps Script CLI) is installed and authenticated. Used by legacy GAS builds. |
| [`clean-index.js`](clean-index.js) | Removes `dist/**/index.js` files after bundling — part of the Apps Script build chain. |
| [`flatten-dist.js`](flatten-dist.js) | Moves all `dist/**/*.js` files into a flat `dist/` for GAS upload. |
| [`mkdir-dist.js`](mkdir-dist.js) | Ensures `dist/` exists before a build. |
| [`watch.js`](watch.js) | esbuild watch mode for `src/{core,api}/*/index.ts` entry points. |

## Verification / testing

| Script | Purpose |
|---|---|
| [`smoke-test-observability.sh`](smoke-test-observability.sh) | End-to-end smoke test of the observability docker-compose stack: sends a synthetic OTLP trace and polls Tempo. Requires Docker Compose V2. |
| [`validate-analytics-taxonomy.mjs`](validate-analytics-taxonomy.mjs) | Verifies `AnalyticsConstants.kt` is in sync with `packages/types/src/analytics.ts`. Exits 0 if the Kotlin file is absent (future work). |

---

When adding a new script:

1. Drop a one-paragraph header comment at the top of the script (purpose,
   prerequisites, usage).
2. Add a row to the appropriate table above — keep tables sorted alphabetically
   within each group.
3. If the script is part of a workflow documented in `docs/`, link to it from
   the relevant doc.
