#!/usr/bin/env bash
#
# bootstrap-gcp-prod.sh — one-time GCP bootstrap for lifting-logbook production deploy.
#
# Creates the GCP project, links a billing account, enables the bootstrap APIs that
# Terraform itself needs in order to enable the rest of the APIs, and provisions the
# Terraform remote-state bucket. Each step is idempotent — safe to re-run if a previous
# attempt failed partway.
#
# Prereqs:
#   * gcloud CLI installed and on PATH (https://cloud.google.com/sdk/docs/install)
#   * Authenticated: `gcloud auth login` AND `gcloud auth application-default login`
#
# Usage:
#   ./scripts/bootstrap-gcp-prod.sh <billing-account-id> [--project-id <id>] [--region <region>]
#
# Example:
#   ./scripts/bootstrap-gcp-prod.sh 0X0X0X-0X0X0X-0X0X0X
#
# Find your billing account ID with: gcloud billing accounts list

set -euo pipefail

PROJECT_ID="lifting-logbook-prod"
PROJECT_NAME="Lifting Logbook Prod"
REGION="us-central1"
BILLING=""

while (( $# > 0 )); do
  case "$1" in
    --project-id)
      PROJECT_ID="$2"
      shift 2
      ;;
    --region)
      REGION="$2"
      shift 2
      ;;
    --help|-h)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    -*)
      echo "Unknown flag: $1" >&2
      exit 2
      ;;
    *)
      if [[ -z "$BILLING" ]]; then
        BILLING="$1"
        shift
      else
        echo "Unexpected positional arg: $1" >&2
        exit 2
      fi
      ;;
  esac
done

STATE_BUCKET="${PROJECT_ID}-tfstate"

if [[ -z "$BILLING" ]]; then
  echo "Usage: $0 <billing-account-id> [--project-id <id>] [--region <region>]" >&2
  echo "Find your billing account ID with: gcloud billing accounts list" >&2
  exit 2
fi

if ! [[ "$BILLING" =~ ^[A-Z0-9]{6}-[A-Z0-9]{6}-[A-Z0-9]{6}$ ]]; then
  echo "Billing account ID '$BILLING' does not look right." >&2
  echo "Expected format: XXXXXX-XXXXXX-XXXXXX (uppercase letters/digits)." >&2
  exit 2
fi

command -v gcloud >/dev/null \
  || { echo "gcloud not found on PATH. See https://cloud.google.com/sdk/docs/install" >&2; exit 1; }
command -v gsutil >/dev/null \
  || { echo "gsutil not found on PATH (usually installed alongside gcloud)." >&2; exit 1; }

ACTIVE_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null || true)
if [[ -z "$ACTIVE_ACCOUNT" ]]; then
  echo "No active gcloud account. Run:" >&2
  echo "  gcloud auth login" >&2
  echo "  gcloud auth application-default login" >&2
  exit 1
fi
echo "Authenticated as: $ACTIVE_ACCOUNT"

echo "==> Validating billing account $BILLING is accessible"
gcloud billing accounts describe "$BILLING" >/dev/null \
  || { echo "Billing account $BILLING is not accessible to $ACTIVE_ACCOUNT." >&2; exit 1; }

echo "==> Creating project $PROJECT_ID (skip if it already exists)"
if gcloud projects describe "$PROJECT_ID" >/dev/null 2>&1; then
  echo "    project $PROJECT_ID already exists"
else
  gcloud projects create "$PROJECT_ID" --name="$PROJECT_NAME"
fi

echo "==> Linking billing account to $PROJECT_ID"
gcloud billing projects link "$PROJECT_ID" --billing-account="$BILLING"

echo "==> Setting $PROJECT_ID as active gcloud project"
gcloud config set project "$PROJECT_ID"

echo "==> Enabling bootstrap APIs (cloudresourcemanager, iam)"
gcloud services enable \
  cloudresourcemanager.googleapis.com \
  iam.googleapis.com \
  --project="$PROJECT_ID"

echo "==> Creating Terraform state bucket gs://$STATE_BUCKET (skip if it already exists)"
if gsutil ls -b "gs://$STATE_BUCKET" >/dev/null 2>&1; then
  echo "    bucket gs://$STATE_BUCKET already exists"
else
  gsutil mb -p "$PROJECT_ID" -l "$REGION" "gs://$STATE_BUCKET"
fi

echo "==> Enabling versioning on the state bucket"
gsutil versioning set on "gs://$STATE_BUCKET"

cat <<EOF

Bootstrap complete for project '$PROJECT_ID'.

Next steps (from docs/deploy.md and the production deploy plan):
  1. Create the Clerk production app at https://clerk.com and copy pk_live_… / sk_live_…
  2. Update infra/terraform/terraform.tfvars.production with project_id="$PROJECT_ID"
     and (for single-user) enable_gke=false
  3. Run the first Terraform apply locally:
       cd infra/terraform
       terraform init -backend-config="bucket=$STATE_BUCKET"
       terraform workspace new production
       terraform apply -var-file=terraform.tfvars.production \\
         -var="billing_account=$BILLING"
  4. Capture Workload Identity outputs and paste into GitHub Actions secrets:
       terraform output workload_identity_provider
       terraform output cicd_service_account_email
  5. Populate Clerk secrets in Secret Manager:
       echo -n "sk_live_..." | gcloud secrets versions add \\
         ${PROJECT_ID}-clerk-secret-key --data-file=-
       echo -n "pk_live_..." | gcloud secrets versions add \\
         ${PROJECT_ID}-clerk-publishable-key --data-file=-
  6. Apply database migrations via Cloud SQL Auth Proxy (see docs/deploy.md).
  7. Merge to main — GitHub Actions will deploy.

EOF
