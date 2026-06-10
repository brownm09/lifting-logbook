# Deployment Guide

This project deploys to Google Cloud Platform using Terraform (infrastructure) and
GitHub Actions (CI/CD). The deployment topology follows [ADR-009](adr/ADR-009-infrastructure.md):
GKE Autopilot receives 90% of traffic; Cloud Run receives 10% as an A/B comparison target.

> **Just deploying for yourself?** See [`deploy-single-user.md`](deploy-single-user.md)
> for a slimmer walkthrough that sets `enable_gke = false` and skips the entire
> Helm/kubectl pipeline. The remainder of this document is the canonical
> two-deploy-target setup that satisfies ADR-009.
>
> **Activating staging on top of an existing production deploy?** See
> [`staging-runbook.md`](staging-runbook.md) for a linear top-to-bottom checklist that
> cross-references the staging-only steps of this document.

---

## Architecture overview

```
GitHub Actions (push to main)
  │
  ├─ terraform apply (staging workspace)
  ├─ docker build + push → Artifact Registry
  ├─ helm upgrade → GKE Autopilot (staging namespace)
  ├─ gcloud run deploy → Cloud Run (staging services)
  ├─ smoke test (HTTP health checks)
  │
  └─ [manual approval — GitHub environment protection]
       │
       ├─ terraform apply (production workspace)
       ├─ helm upgrade → GKE Autopilot (production namespace)
       └─ gcloud run deploy → Cloud Run (production services)
```

Two GCP projects are used for environment isolation:
- `lifting-logbook-staging` — staging environment
- `lifting-logbook-prod` — production environment

---

## Deploy modes

The Terraform module supports two modes via the `enable_gke` variable
([`infra/terraform/variables.tf`](../infra/terraform/variables.tf)):

| Mode | `enable_gke` | What runs | When to use |
|---|---|---|---|
| Default / ADR-009 A/B | `true` (default) | GKE Autopilot **and** Cloud Run | Multi-user or portfolio deploy; preserves the A/B comparison this project is built around. |
| Single-user / Cloud-Run-only | `false` | Cloud Run only | One-person deploys where ~\$30/mo of GKE Autopilot cost has no benefit. Full walkthrough: [`deploy-single-user.md`](deploy-single-user.md). |

The `cloud_run_min_instances` variable controls Cloud Run scale-to-zero
(`null` = environment default; `0` = always scale to zero for personal
deployments; `1` = production-grade warm start).

In default mode, this guide applies as written. In single-user mode, follow
[`deploy-single-user.md`](deploy-single-user.md) instead — the bootstrap is
scripted (`scripts/bootstrap-gcp.sh`), only one GCP project is needed,
and the GKE-only Helm/kubectl steps in the CI workflow are skipped via an
`if: <ctx>.gke_enabled == 'true'` guard.

### Flipping between modes on an existing environment

You can move an environment from one mode to the other by toggling
`enable_gke` and re-applying. **Uninstall Helm releases before disabling GKE**
so any cluster-managed cloud resources (load balancer IPs, attached PVCs)
are torn down before Terraform destroys the cluster:

```bash
# GKE-enabled → Cloud-Run-only
helm uninstall api -n production
helm uninstall web -n production
# then set enable_gke = false and run terraform apply
```

Going the other direction (Cloud-Run-only → GKE-enabled) needs no cleanup —
flip the variable, `terraform apply`, then push to `main` to let CI deploy
the Helm releases onto the freshly created cluster.

---

## One-time bootstrap (do this once before the first deploy)

### Prerequisites

- [Google Cloud SDK (`gcloud`)](https://cloud.google.com/sdk/docs/install) installed and authenticated (`gcloud auth login`)
- [Terraform >= 1.7](https://developer.hashicorp.com/terraform/install)
- A Google account with billing enabled
- A [GitHub](https://github.com) account with access to this repository

---

### Step 1 — Create GCP projects

```bash
# Replace BILLING_ACCOUNT with your actual billing account ID
# Find it with: gcloud billing accounts list
BILLING_ACCOUNT="XXXXXX-XXXXXX-XXXXXX"

gcloud projects create lifting-logbook-staging --name="Lifting Logbook Staging"
gcloud projects create lifting-logbook-prod     --name="Lifting Logbook Production"

gcloud billing projects link lifting-logbook-staging --billing-account="$BILLING_ACCOUNT"
gcloud billing projects link lifting-logbook-prod     --billing-account="$BILLING_ACCOUNT"
```

---

### Step 2 — Create the Terraform state bucket and grant CI/CD access

Terraform stores remote state in GCS. Create the bucket once in the production project
(it will hold state for both workspaces — staging and production).

```bash
gsutil mb -p lifting-logbook-prod \
           -l us-central1 \
           gs://lifting-logbook-prod-tfstate

gsutil versioning set on gs://lifting-logbook-prod-tfstate
```

After the first `terraform apply` (Step 3) creates the CI/CD service accounts, grant both SAs
`roles/storage.objectAdmin` on the bucket. The bucket lives in the prod project, so neither
SA can manage this IAM binding via Terraform from within their own CI context — grant it once
out-of-band with your personal account (which has access to both projects):

```bash
# Grant staging CI/CD SA access (run after the staging terraform apply in Step 3)
gcloud storage buckets add-iam-policy-binding gs://lifting-logbook-prod-tfstate \
  --member="serviceAccount:lifting-logbook-stg-cicd@lifting-logbook-staging.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

# Grant production CI/CD SA access (run after the production terraform apply in Step 3)
gcloud storage buckets add-iam-policy-binding gs://lifting-logbook-prod-tfstate \
  --member="serviceAccount:lifting-logbook-prod-cicd@lifting-logbook-prod.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"
```

These grants are idempotent — safe to re-run. They persist independently of Terraform state.

---

### Step 3 — Bootstrap Terraform (first apply)

The first `terraform apply` creates all GCP resources including the Workload Identity
Federation pool used by subsequent CI/CD runs.

```bash
cd infra/terraform

# Enable the IAM and resource manager APIs manually (required before Terraform can run)
gcloud services enable cloudresourcemanager.googleapis.com iam.googleapis.com \
  --project=lifting-logbook-staging
gcloud services enable cloudresourcemanager.googleapis.com iam.googleapis.com \
  --project=lifting-logbook-prod

# Fill in your billing account in the tfvars files
# infra/terraform/terraform.tfvars.staging
# infra/terraform/terraform.tfvars.production

# Apply staging
terraform init -backend-config="bucket=lifting-logbook-prod-tfstate" \
               -backend-config="prefix=terraform/state"
terraform workspace new staging
terraform apply -var-file=terraform.tfvars.staging

# Capture outputs needed for GitHub secrets (see Step 5)
terraform output workload_identity_provider
terraform output cicd_service_account_email

# Apply production
terraform workspace new production
terraform apply -var-file=terraform.tfvars.production

terraform output workload_identity_provider
terraform output cicd_service_account_email
```

> **CI/CD IAM recovery.** Each `terraform apply` above grants the CI/CD service account
> `roles/owner` on its project so subsequent CI-driven applies can manage IAM bindings on
> Secret Manager and KMS (Editor + projectIamAdmin fall short on `setIamPolicy` for several
> resource types). If you bootstrap with an older toolchain that predates this binding —
> symptom: CI fails with `Error 403 ... setIamPolicy denied` — run the recovery script once
> from your laptop as a project owner, then push to main:
>
> ```bash
> ./scripts/fix-cicd-sa-iam.sh --project-id lifting-logbook-staging
> ./scripts/fix-cicd-sa-iam.sh --project-id lifting-logbook-prod
> ```
>
> Bindings are idempotent and get re-asserted by Terraform on the next apply.
>
> **TF state bucket access** (`does not have storage.objects.list access`) is a separate issue —
> see Step 2 for the required out-of-band gcloud commands that grant both SAs `roles/storage.objectAdmin`
> on the shared bucket.

---

### Step 3.5 — Seed staging data

After Terraform has provisioned the staging Cloud SQL instance and the database URL secret is set,
run the Prisma seed script to populate the staging database with synthetic lift data. This gives
the environment realistic data for testing cycle generation, reporting, and API endpoints without
any real user PII.

**When to run:** after `prisma migrate deploy` completes on the staging database (the deploy
pipeline runs the `lifting-logbook-stg-migrate` Cloud Run Job automatically — see
[ADR-027](adr/ADR-027-deploy-pipeline-migrations.md); for manual runs use
`./scripts/migrate-staging-db.sh`).

**What it creates:**

| Table | Rows |
|---|---|
| `user_settings` | 1 (seed user) |
| `lift_metadata` | 6 lifts (squat, deadlift, bench-press, overhead-press, barbell-row, romanian-deadlift) |
| `training_max` | 6 (current maxes after 12 cycles) |
| `training_max_history` | ~24 (PR entries every 3rd cycle) |
| `cycle_dashboard` | 1 (current cycle state) |
| `strength_goal` | 6 (relative bodyweight ratio targets) |
| `lift_record` | ~216 (12 cycles × 3 workouts × 2 lifts/workout × 3 sets) |

**Seed user ID:** `seed_user_clerkid_staging_001` — this is a synthetic Clerk user ID. It will
not appear in your Clerk dashboard and cannot be accessed via a real auth token. It is useful for
schema validation, API smoke tests, and query testing.

**Command:**

```bash
# Via Cloud SQL Auth Proxy (connect to staging DB locally)
# Use port 5434 (avoids conflict with prod proxy on 5433)
# sslmode=disable required: proxy handles TLS; Prisma must not negotiate SSL independently
cloud-sql-proxy "lifting-logbook-staging:us-central1:lifting-logbook-stg-db-<suffix>?port=5434" &
DATABASE_URL="postgresql://lifting-logbook-app:<password>@127.0.0.1:5434/lifting_logbook?sslmode=disable" \
  npx --prefix apps/api prisma db seed
```

**Idempotency:** the seed script uses `upsert` on all tables. Re-running it is safe — existing
rows are left unchanged, and no duplicates are created.

---

### Step 4 — Sign up for Clerk and create two apps

[Clerk](https://clerk.com) is the authentication provider. It has a free tier.

1. Go to [clerk.com](https://clerk.com) and create an account.
2. Create an app named **lifting-logbook-staging**.
3. Create a second app named **lifting-logbook-production**.
4. For each app, go to **Configure → API keys** and note:
   - **Publishable key** (`pk_test_...` for staging, `pk_live_...` for production)
   - **Secret key** (`sk_test_...` for staging, `sk_live_...` for production)

Store each key pair in GCP Secret Manager:

```bash
# Staging
echo -n "sk_test_YOUR_KEY" | gcloud secrets versions add \
  lifting-logbook-stg-clerk-secret-key --data-file=- \
  --project=lifting-logbook-staging

echo -n "pk_test_YOUR_KEY" | gcloud secrets versions add \
  lifting-logbook-stg-clerk-publishable-key --data-file=- \
  --project=lifting-logbook-staging

# Production
echo -n "sk_live_YOUR_KEY" | gcloud secrets versions add \
  lifting-logbook-prod-clerk-secret-key --data-file=- \
  --project=lifting-logbook-prod

echo -n "pk_live_YOUR_KEY" | gcloud secrets versions add \
  lifting-logbook-prod-clerk-publishable-key --data-file=- \
  --project=lifting-logbook-prod
```

---

### Step 5 — Add GitHub repository secrets and variables

In the GitHub repository → **Settings → Secrets and variables → Actions**:

**Repository secrets** (Secrets tab):

| Secret | Value |
|---|---|
| `GCP_STAGING_WORKLOAD_IDENTITY_PROVIDER` | staging `terraform output workload_identity_provider` |
| `GCP_STAGING_SERVICE_ACCOUNT` | staging `terraform output cicd_service_account_email` |
| `GCP_PROD_WORKLOAD_IDENTITY_PROVIDER` | production `terraform output workload_identity_provider` |
| `GCP_PROD_SERVICE_ACCOUNT` | production `terraform output cicd_service_account_email` |
| `GCP_BILLING_ACCOUNT` | your billing account ID (used by terraform apply in CI) |
| `TF_STATE_BUCKET` | `lifting-logbook-prod-tfstate` |

**Repository variables** (Variables tab):

| Variable | Value |
|---|---|
| `GCP_STAGING_PROJECT_ID` | `lifting-logbook-staging` |
| `GCP_PROD_PROJECT_ID` | `lifting-logbook-prod` |

> **Why variables, not secrets?** GCP project IDs are not sensitive — they appear in
> Cloud Console URLs, API responses, and `gcloud` output. Storing them as secrets causes
> GitHub Actions to mask any workflow output that contains the value, which silently breaks
> job-to-job data passing (e.g., the `ar_repo` output used to resolve the Artifact Registry
> URL — a masked project ID produces `us-central1-docker.pkg.dev//lifting-logbook/api:tag`
> with an empty path segment that fails buildx).
>
> **Migrating an existing deploy?** If you previously stored `GCP_STAGING_PROJECT_ID` or
> `GCP_PROD_PROJECT_ID` as repository secrets, delete the secret entries after creating the
> variables. A leftover masked secret with the same name is a foot-gun if any workflow is
> ever changed to reference `secrets.GCP_*_PROJECT_ID` — the failure mode reappears silently.

---

### Step 6 — Configure GitHub environment protection rules

1. Go to **Settings → Environments** in the GitHub repository.
2. Create an environment named **`production`**.
3. Under **Deployment protection rules**, add yourself as a **Required reviewer**.

This is the manual approval gate that prevents automatic production deploys.
The `deploy-production` job in `.github/workflows/deploy.yml` will pause and
wait for your approval before proceeding. To approve a paused run (UI or `gh` CLI),
see [Approving a production deploy](#approving-a-production-deploy) under Ongoing operations.

---

### Step 7 — Push to main

The first push to `main` after completing the bootstrap steps will trigger the full pipeline.
Monitor it in **Actions** on GitHub. The staging URL will appear in the `deploy-staging` job output;
the production URL will appear in the `deploy-production` job summary after approval.

---

## Ongoing operations

### Deploying a change

Push or merge to `main`. The pipeline runs automatically.

### Approving a production deploy

After `build-images`, `deploy-staging`, and `smoke-test` succeed, the run pauses at the
`production` environment gate (the Required-reviewer rule from [Step 6](#step-6--configure-github-environment-protection-rules))
and waits for approval before the `deploy-production` job starts. This gate is what applies
pending Prisma migrations to prod — it sits in front of the in-VPC migrate job and the
DB-backed `/readyz` smoke ([ADR-027](adr/ADR-027-deploy-pipeline-migrations.md)) — so approve
it deliberately, after sanity-checking staging.

**From the GitHub UI:** open the Deploy workflow run, click **Review deployments**, select
`production`, and approve.

**From the CLI (no browser):**

```bash
# Find the latest Deploy run on main
RUNID=$(gh run list --workflow Deploy --branch main --limit 1 --json databaseId -q '.[0].databaseId')

# Inspect what is pending approval (optional)
gh api repos/brownm09/lifting-logbook/actions/runs/$RUNID/pending_deployments

# Approve the production environment (id 15694632193)
gh api repos/brownm09/lifting-logbook/actions/runs/$RUNID/pending_deployments \
  -X POST -f state=approved -F 'environment_ids[]=15694632193' -f comment="approved via gh"
```

The `production` environment id is `15694632193`. To **reject** instead, use `-f state=rejected`.

### Web image: per-env build (ADR-025)

The `apps/web` image is built **twice per pipeline run** when staging is enabled:

- `web:<sha>-staging` — built with staging `NEXT_PUBLIC_API_URL` and
  `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`. Deployed exclusively by `deploy-staging`.
- `web:<sha>-prod` — built with production values. Deployed exclusively by `deploy-production`.
  Also tagged `:latest`.

In production-only mode (no staging configured), only the `-prod` image is built.

See [ADR-025](adr/ADR-025-web-image-per-env-build.md) for the rationale and the explicit
trade — the staging gate validates image structure and boot behavior, **not** the embedded
production `NEXT_PUBLIC_*` values.

#### Adding a new `NEXT_PUBLIC_*` variable

Every new `NEXT_PUBLIC_*` value must be wired into **both** web-image build invocations in
`.github/workflows/deploy.yml` → `build-images`. Checklist:

1. Add `ARG <NAME>` to `apps/web/Dockerfile` builder stage.
2. Add staging value resolution as a new step alongside `clerk-pub-staging` (gated on
   `staging_enabled == true`). Use `gcloud secrets versions access` for secret-store values
   or a Terraform output for infra-derived values.
3. Add production value resolution as a new step alongside `clerk-pub-prod`.
4. Wire both into the `build-args:` block of `Build and push web image (staging)` and
   `Build and push web image (production)`.
5. Mask secret-store values with `::add-mask::` before writing to `GITHUB_OUTPUT`.
6. Update this section if the variable affects deploy behavior at runtime as well.

Forgetting any of the above resurrects the bug ADR-025 was written to fix.

#### Verifying per-env web image build (deliberate dry-run)

After a deploy completes, confirm each environment's bundle contains only its own
`NEXT_PUBLIC_*` values. From a workstation with both env's Clerk publishable-key prefixes
known (e.g., `pk_test_...` for staging, `pk_live_...` for production):

```bash
# Production must NOT contain staging Clerk key prefix or staging API hostname.
PROD_WEB="$(gcloud run services describe lifting-logbook-prod-web \
  --region=us-central1 --project=lifting-logbook-prod --format='value(status.url)')"
STG_API_HOST="$(gcloud run services describe lifting-logbook-stg-api \
  --region=us-central1 --project=lifting-logbook-stg --format='value(status.url)' \
  | sed -e 's#^https\?://##' -e 's#/.*##')"
STG_PK_PREFIX="pk_test_"  # adjust to actual staging key's distinguishing prefix

curl -sL "$PROD_WEB" -o /tmp/prod-index.html
# Pull each referenced /_next/static/chunks/*.js and grep
for chunk in $(grep -oE '/_next/static/chunks/[a-zA-Z0-9_./-]+\.js' /tmp/prod-index.html | sort -u); do
  curl -sL "${PROD_WEB}${chunk}" | grep -E "($STG_API_HOST|$STG_PK_PREFIX)" \
    && { echo "FAIL: staging value found in $chunk"; exit 1; }
done
echo "OK: production bundle is free of staging values"
```

Run the symmetric check against staging for the production values. Both must produce
`OK:` to satisfy the verification gate from
[#388](https://github.com/brownm09/lifting-logbook/issues/388).

#### First-time prod bootstrap

The `build-images` job's `Resolve production API URL` step calls
`gcloud run services describe lifting-logbook-prod-api` before
`terraform-production` has had a chance to create that service. On the very
first deploy to a new prod project this aborts `build-images` and (in
staging-enabled mode) also blocks the staging deploy. Recovery:

1. From a workstation with prod credentials, run `terraform apply` against
   the production workspace manually:
   ```bash
   cd infra/terraform
   terraform init -backend-config="bucket=<TF_STATE_BUCKET>" \
                  -backend-config="prefix=terraform/state"
   terraform workspace select production || terraform workspace new production
   terraform apply -var-file=terraform.tfvars.production \
                   -var="billing_account=<billing-account-id>"
   ```
2. Confirm the prod Cloud Run API service now exists:
   ```bash
   gcloud run services describe lifting-logbook-prod-api \
     --region=us-central1 --project=<prod-project>
   ```
3. Re-run the failed CI pipeline. `Resolve production API URL` now succeeds
   and the rest of `build-images` and the downstream deploys proceed.

This is a one-time bootstrap concern per prod project. The long-term fix
(hoisting `terraform-production` to its own job so `build-images` can
depend on its outputs) is documented in ADR-025 as a deferred follow-up.

### Recovering from CI/CD IAM errors

If a CI run fails with `Error 403 ... setIamPolicy denied`, the CI/CD service account is
missing the `roles/owner` binding that subsequent applies depend on. Re-run the recovery
script from your laptop as a project owner — see the [CI/CD IAM recovery callout under Step 3](#step-3--bootstrap-terraform-first-apply)
for the full explanation and commands.

If a CI run fails with `does not have storage.objects.list access` on the Terraform init step,
the CI/CD SA is missing `roles/storage.objectAdmin` on `lifting-logbook-prod-tfstate` — see
Step 2 for the out-of-band gcloud commands.

### Rolling back

```bash
# Roll back GKE deployment to the previous Helm revision
helm rollback api -n production
helm rollback web -n production

# Roll back Cloud Run to the previous revision
gcloud run services update-traffic lifting-logbook-prod-api \
  --to-revisions=PREVIOUS_REVISION=100 \
  --region=us-central1 --project=lifting-logbook-prod
```

### Running database migrations

**The deploy pipeline applies Prisma migrations automatically (ADR-027).** On every
deploy, `deploy.yml` (prod + staging) and `staging.yml` (PR staging) run the
`lifting-logbook-<env>-migrate` Cloud Run Job — `prisma migrate deploy && prisma migrate
status` — *before* the new API revision goes live. The job runs inside the VPC (the Cloud
SQL instance has a private IP only), so a GitHub-hosted runner never connects to the DB
directly. `gcloud run jobs execute --wait` returns non-zero if a migration or the
`migrate status` drift check fails, which halts the deploy and leaves the last-good API
revision serving. No manual step is required for normal deploys.

As a runtime complement, the production deploy then runs a **DB-backed smoke test**: it mints
a Cloud Run identity token and probes the API's `GET /readyz` (a `@Public`, no-Clerk endpoint
that runs `SELECT 1`). A non-200 fails the deploy — catching the case where the API is up but
cannot actually serve database requests (the failure that left prod silently 500ing in #458,
which no smoke previously detected). The two guards divide the work: `migrate status` (pre-deploy)
ensures the schema is migrated; `/readyz` (post-deploy) ensures the live service can serve it.
`/readyz` does not auto-roll-back on failure — roll back the API revision manually (see
[Rolling back](#rolling-back) / `gcloud run services update-traffic`).

> Until ADR-027 (#460) this was not the case: `prisma migrate deploy` ran only in
> `ci.yml` against the CI test database, so prod schema drifted silently — a missing
> `custom_lift` table 500'd the lift-catalog endpoint (#458). Adding a migration without
> deploying is now safe: the next deploy applies it.

**Break-glass / bootstrap (manual):** to apply migrations out of band — first-time
bootstrap before any deploy, or recovery when the pipeline is unavailable — use the
sanctioned script, which temporarily enables a public IP scoped to your IP, proxies in via
the Cloud SQL Auth Proxy (IAM-authenticated), runs `prisma migrate deploy`, then removes
the public IP. It is idempotent:

```bash
./scripts/migrate-prod-db.sh       # production
./scripts/migrate-staging-db.sh    # staging (proxy on port 5434)
```

The non-Prisma `user_data_source` table (managed outside Prisma) lives in
`infra/migrations/`; both scripts apply `infra/migrations/001_create_user_data_source.sql`
after the Prisma migrations.

### OTel Collector / Grafana Cloud telemetry

**The deploy pipeline deploys the OTel Collector DaemonSet automatically (#474).** On every
GKE deploy, `deploy.yml` (staging + production) syncs the Grafana Cloud auth headers from
Secret Manager into the `otel-collector-secrets` Kubernetes Secret and runs
`helm upgrade --install otel-collector` with the per-env values file. Traces flow to Tempo,
logs to Loki, and **metrics to Mimir over the OTLP gateway** (`otlphttp/metrics` exporter —
the path `APIRouteHighErrorRate` depends on; `:8889` is not scraped in GKE). The Cloud Run
A/B replica does not yet ship telemetry — see the deferred follow-up to #474.

**One-time token bootstrap (do this once per environment, before the deploy that needs it).**
The auth headers are never committed: Terraform creates the Secret Manager containers with a
`REPLACE_ME` placeholder, and you populate the real Grafana token here. The sync step fails
the deploy loudly if the placeholder is still in place.

1. **Get the values from the Grafana Cloud portal:**
   - **OTLP endpoint + instance ID** — Stack → Details → OpenTelemetry → *OTLP endpoint* and
     the numeric *Instance ID / User* (this endpoint also routes metrics → Mimir).
   - **Loki endpoint + user** — Stack → Details → Loki → *URL* (append `/loki/api/v1/push`)
     and its *User*. The OTLP and Loki instance IDs may differ but can share one token.
   - **API token** — Stack → Details → generate a token with **send metrics + send logs +
     send traces** scopes (or a service account with those permissions).

   The endpoint URLs are non-secret and live in
   `infra/kubernetes/values/{staging,production}-otel-collector.yaml` — confirm they match
   your stack's region and update them there if needed.

2. **Build the Basic-auth headers** (the collector sends these verbatim):
   ```bash
   OTLP_HEADER="Basic $(printf '%s:%s' "$OTLP_INSTANCE_ID" "$GRAFANA_TOKEN" | base64 -w0)"
   LOKI_HEADER="Basic $(printf '%s:%s' "$LOKI_INSTANCE_ID" "$GRAFANA_TOKEN" | base64 -w0)"
   ```

3. **Populate Secret Manager** for each environment (`stg` against the staging project,
   `prod` against the production project):
   ```bash
   printf '%s' "$OTLP_HEADER" | gcloud secrets versions add lifting-logbook-stg-otel-otlp-auth-header --data-file=- --project=<STAGING_PROJECT_ID>
   printf '%s' "$LOKI_HEADER" | gcloud secrets versions add lifting-logbook-stg-otel-loki-auth-header --data-file=- --project=<STAGING_PROJECT_ID>
   printf '%s' "$OTLP_HEADER" | gcloud secrets versions add lifting-logbook-prod-otel-otlp-auth-header --data-file=- --project=<PROD_PROJECT_ID>
   printf '%s' "$LOKI_HEADER" | gcloud secrets versions add lifting-logbook-prod-otel-loki-auth-header --data-file=- --project=<PROD_PROJECT_ID>
   ```
   The secret containers are created by `terraform apply` (see `infra/terraform/main.tf`).
   If applying Terraform out of band, `gcloud secrets create <name> --replication-policy=automatic`
   first, then `versions add`.

   > **Single shared stack (free tier).** Staging and production reuse the *same* Grafana Cloud
   > stack, endpoints, and token here. Because the API does not yet emit a `deployment.environment`
   > attribute, the two environments' telemetry intermix and staging 5xx can trip prod alerts —
   > tracked in [#487](https://github.com/brownm09/lifting-logbook/issues/487). If you later move to
   > separate stacks, give each env its own endpoints (the per-env values files) and token (the
   > per-env secrets) instead.

After the secrets are populated, the next push-to-main deploy wires telemetry end to end —
verify in Grafana Cloud: Tempo `{ service.name = "lifting-logbook-api" }`, Loki
`{ service_name = "lifting-logbook-api" }`, and the `http.server.*` metric in Mimir. The
operational runbook is [`docs/runbooks/observability.md`](runbooks/observability.md).

### Accessing logs

```bash
# GKE
kubectl logs -n production -l app=api --tail=100

# Cloud Run
gcloud logging read "resource.type=cloud_run_revision AND \
  resource.labels.service_name=lifting-logbook-prod-api" \
  --limit=50 --project=lifting-logbook-prod
```

---

## Cost estimates

| Resource | Staging | Production | Production (single-user, `enable_gke=false`) |
|---|---|---|---|
| GKE Autopilot (1 replica × 250m CPU × 256Mi) | ~$15/mo | ~$30/mo (2 replicas) | — (skipped) |
| Cloud SQL (db-f1-micro / db-g1-small) | ~$8/mo | ~$25/mo | ~$10–25/mo (tier-dependent) |
| Cloud Run (low traffic) | ~$0–2/mo | ~$0–5/mo | ~$0–5/mo |
| Artifact Registry | <$1/mo | <$1/mo | <$1/mo |
| **Total** | **~$24/mo** | **~$61/mo** | **~$15–30/mo** |

> GKE Autopilot charges for requested pod resources, not node capacity.
> Idle pods with minimal resource requests keep costs low.
> See [GKE Autopilot pricing](https://cloud.google.com/kubernetes-engine/pricing#autopilot_mode).
