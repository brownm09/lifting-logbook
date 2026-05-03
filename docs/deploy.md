# Deployment Guide

This project deploys to Google Cloud Platform using Terraform (infrastructure) and
GitHub Actions (CI/CD). The deployment topology follows [ADR-009](adr/ADR-009-infrastructure.md):
GKE Autopilot receives 90% of traffic; Cloud Run receives 10% as an A/B comparison target.

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

### Step 2 — Create the Terraform state bucket

Terraform stores remote state in GCS. Create the bucket once in the staging project
(it will hold state for both workspaces).

```bash
gsutil mb -p lifting-logbook-staging \
           -l us-central1 \
           gs://lifting-logbook-tfstate

gsutil versioning set on gs://lifting-logbook-tfstate
```

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
terraform init -backend-config="bucket=lifting-logbook-tfstate" \
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

### Step 5 — Add GitHub repository secrets

In the GitHub repository → **Settings → Secrets and variables → Actions**, add:

| Secret | Value |
|---|---|
| `GCP_STAGING_PROJECT_ID` | `lifting-logbook-staging` |
| `GCP_PROD_PROJECT_ID` | `lifting-logbook-prod` |
| `GCP_STAGING_WORKLOAD_IDENTITY_PROVIDER` | staging `terraform output workload_identity_provider` |
| `GCP_STAGING_SERVICE_ACCOUNT` | staging `terraform output cicd_service_account_email` |
| `GCP_PROD_WORKLOAD_IDENTITY_PROVIDER` | production `terraform output workload_identity_provider` |
| `GCP_PROD_SERVICE_ACCOUNT` | production `terraform output cicd_service_account_email` |
| `TF_STATE_BUCKET` | `lifting-logbook-tfstate` |

---

### Step 6 — Configure GitHub environment protection rules

1. Go to **Settings → Environments** in the GitHub repository.
2. Create an environment named **`production`**.
3. Under **Deployment protection rules**, add yourself as a **Required reviewer**.

This is the manual approval gate that prevents automatic production deploys.
The `deploy-production` job in `.github/workflows/deploy.yml` will pause and
wait for your approval before proceeding.

---

### Step 7 — Push to main

The first push to `main` after completing the bootstrap steps will trigger the full pipeline.
Monitor it in **Actions** on GitHub. The staging URL will appear in the `deploy-staging` job output;
the production URL will appear in the `deploy-production` job summary after approval.

---

## Ongoing operations

### Deploying a change

Push or merge to `main`. The pipeline runs automatically.

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

Migrations live in `infra/migrations/`. To apply:

```bash
# Connect to Cloud SQL via the Cloud SQL Auth Proxy
cloud-sql-proxy "lifting-logbook-prod:us-central1:<instance-name>"

# Then apply migrations with psql or your migration runner
psql "$DATABASE_URL" -f infra/migrations/001_create_user_data_source.sql
```

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

| Resource | Staging | Production |
|---|---|---|
| GKE Autopilot (1 replica × 250m CPU × 256Mi) | ~$15/mo | ~$30/mo (2 replicas) |
| Cloud SQL (db-f1-micro / db-g1-small) | ~$8/mo | ~$25/mo |
| Cloud Run (low traffic) | ~$0–2/mo | ~$0–5/mo |
| Artifact Registry | <$1/mo | <$1/mo |
| **Total** | **~$24/mo** | **~$61/mo** |

> GKE Autopilot charges for requested pod resources, not node capacity.
> Idle pods with minimal resource requests keep costs low.
> See [GKE Autopilot pricing](https://cloud.google.com/kubernetes-engine/pricing#autopilot_mode).
