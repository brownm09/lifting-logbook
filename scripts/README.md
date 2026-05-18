# scripts/

Repository automation scripts. Grouped by lifecycle.

## Local development setup

| Script | Purpose |
|---|---|
| [`dev-setup.sh`](dev-setup.sh) | One-shot local bootstrap: installs Node deps, validates `.nvmrc`, sets up env files for `apps/api` and `apps/web`. Run after cloning. |

## Production deploy

| Script | Purpose |
|---|---|
| [`bootstrap-gcp-prod.sh`](bootstrap-gcp-prod.sh) | One-time GCP bootstrap for a single-user production deploy: creates the project, links billing, enables the APIs Terraform needs, and provisions the Terraform state bucket. Idempotent. See [`docs/deploy-single-user.md`](../docs/deploy-single-user.md). |

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
