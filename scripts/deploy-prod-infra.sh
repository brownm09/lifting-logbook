#!/usr/bin/env bash
#
# deploy-prod-infra.sh — Terraform init/apply for the lifting-logbook production environment.
#
# Run this after bootstrap-gcp.sh has completed. Each step is idempotent — safe
# to re-run. Use --plan-only to preview changes without applying them.
#
# Prereqs:
#   * terraform >= 1.7 on PATH (https://developer.hashicorp.com/terraform/install)
#   * gcloud CLI authenticated: `gcloud auth login` AND `gcloud auth application-default login`
#   * GCP_BILLING_ACCOUNT env var set to your billing account ID (XXXXXX-XXXXXX-XXXXXX)
#
# Usage:
#   ./scripts/deploy-prod-infra.sh [--plan-only] [--workspace <name>] [--project-id <id>] [--region <region>]
#
# Examples:
#   ./scripts/deploy-prod-infra.sh --plan-only      # preview only, no changes
#   ./scripts/deploy-prod-infra.sh                  # full apply

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TF_DIR="$(cd "$SCRIPT_DIR/../infra/terraform" && pwd)"

PROJECT_ID="lifting-logbook-prod"
REGION="us-central1"
WORKSPACE="production"
PLAN_ONLY=false
# Custom domains are specific to this single-user deployment. Override by editing
# this script or by running gcloud beta run domain-mappings create manually (Step 6
# of docs/deploy-single-user.md).
DOMAINS=("liftinglogbook.com" "www.liftinglogbook.com")

usage() {
  awk '
    NR == 1 { next }
    /^[^#]/ { exit }
    /^#$/   { print ""; next }
    /^# ?/  { sub(/^# ?/, ""); print }
  ' "$0"
}

while (( $# > 0 )); do
  case "$1" in
    --plan-only)   PLAN_ONLY=true; shift ;;
    --workspace)   WORKSPACE="$2"; shift 2 ;;
    --project-id)  PROJECT_ID="$2"; shift 2 ;;
    --region)      REGION="$2"; shift 2 ;;
    --help|-h)     usage; exit 0 ;;
    -*)            echo "Unknown flag: $1" >&2; exit 2 ;;
    *)             echo "Unexpected argument: $1" >&2; exit 2 ;;
  esac
done

STATE_BUCKET="${PROJECT_ID}-tfstate"
TFVARS="terraform.tfvars.production"

command -v terraform >/dev/null \
  || { echo "terraform not found on PATH. See https://developer.hashicorp.com/terraform/install" >&2; exit 1; }
command -v gcloud >/dev/null \
  || { echo "gcloud not found on PATH. See https://cloud.google.com/sdk/docs/install" >&2; exit 1; }

ACTIVE_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null || true)
if [[ -z "$ACTIVE_ACCOUNT" ]]; then
  echo "No active gcloud account. Run:" >&2
  echo "  gcloud auth login" >&2
  echo "  gcloud auth application-default login" >&2
  exit 1
fi
echo "Authenticated as: $ACTIVE_ACCOUNT"

# Require billing account — never commit the real ID to version control.
if [[ -z "${GCP_BILLING_ACCOUNT:-}" || "$GCP_BILLING_ACCOUNT" == "REPLACE_ME" || "$GCP_BILLING_ACCOUNT" == "XXXXXX-XXXXXX-XXXXXX" ]]; then
  echo "GCP_BILLING_ACCOUNT is not set or is a placeholder." >&2
  echo "Export your billing account ID before running:" >&2
  echo "  export GCP_BILLING_ACCOUNT=XXXXXX-XXXXXX-XXXXXX" >&2
  exit 1
fi

cd "$TF_DIR"

echo "==> terraform init (bucket=$STATE_BUCKET)"
terraform init -backend-config="bucket=$STATE_BUCKET" -reconfigure

echo "==> selecting workspace: $WORKSPACE"
if terraform workspace list 2>/dev/null | grep -qE "(^|\s|\*)$WORKSPACE(\s|$)"; then
  terraform workspace select "$WORKSPACE"
else
  terraform workspace new "$WORKSPACE"
fi

if $PLAN_ONLY; then
  echo "==> terraform plan"
  terraform plan -var-file="$TFVARS" -var="billing_account=$GCP_BILLING_ACCOUNT"
  echo ""
  echo "No changes applied (--plan-only mode)."
else
  echo "==> terraform apply"
  terraform apply -var-file="$TFVARS" -var="billing_account=$GCP_BILLING_ACCOUNT"
fi

echo ""
echo "==> GitHub Actions secrets — copy these into the repo settings:"
echo "    WIF_PROVIDER  = $(terraform output -raw workload_identity_provider 2>/dev/null || echo '(not yet available)')"
echo "    CICD_SA_EMAIL = $(terraform output -raw cicd_service_account_email 2>/dev/null || echo '(not yet available)')"

echo ""
echo "==> Next: populate Clerk keys in Secret Manager (see docs/deploy.md step 5):"
echo "    echo -n 'sk_live_...' | gcloud secrets versions add ${PROJECT_ID}-clerk-secret-key --data-file=-"
echo "    echo -n 'pk_live_...' | gcloud secrets versions add ${PROJECT_ID}-clerk-publishable-key --data-file=-"

if ! $PLAN_ONLY; then
  echo ""
  echo "==> Mapping custom domains to Cloud Run web service (idempotent)..."
  for DOMAIN in "${DOMAINS[@]}"; do
    if gcloud beta run domain-mappings describe --domain "$DOMAIN" --region "$REGION" --project "$PROJECT_ID" &>/dev/null; then
      echo "    $DOMAIN already mapped — skipping"
    else
      gcloud beta run domain-mappings create \
        --service "${PROJECT_ID}-web" \
        --domain "$DOMAIN" \
        --region "$REGION" \
        --project "$PROJECT_ID"
      echo "    $DOMAIN mapped"
    fi
  done

  echo ""
  echo "==> DNS records required at your registrar:"
  gcloud beta run domain-mappings describe \
    --domain "${DOMAINS[0]}" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format="table(status.resourceRecords[].type, status.resourceRecords[].name, status.resourceRecords[].rrdata)"
fi
