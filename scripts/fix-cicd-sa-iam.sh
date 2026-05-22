#!/usr/bin/env bash
#
# fix-cicd-sa-iam.sh — grant the CI/CD service account the IAM roles required
# for `terraform apply` from GitHub Actions to succeed.
#
# This is a one-time recovery script for production projects that were
# bootstrapped *before* infra/terraform/main.tf was updated to include these
# roles in the `cicd_roles` list. Without these grants, the Deploy workflow
# fails with one of:
#
#   * "does not have storage.objects.list access" (on tfstate bucket)
#   * "Error retrieving IAM policy for project ... 403 forbidden"
#   * Other 403s when terraform tries to read/manage project resources
#
# The chicken-and-egg: `terraform apply` from CI needs these permissions
# before it can grant them to itself. Run this script once, as a user identity
# with project-owner access (the same identity that ran the original local
# `terraform apply` in Step 5 of docs/deploy-single-user.md).
#
# After this runs successfully, the next CI Deploy run will complete the
# `terraform apply` step and take ownership of these bindings via the
# `google_project_iam_member.cicd_roles` and
# `google_storage_bucket_iam_member.cicd_tfstate` resources, so they persist
# across re-applies.
#
# Prereqs:
#   * gcloud authenticated as a project owner: `gcloud auth login`
#   * jq is NOT required
#
# Usage:
#   ./scripts/fix-cicd-sa-iam.sh [--project-id <id>]
#
# Examples:
#   ./scripts/fix-cicd-sa-iam.sh
#   ./scripts/fix-cicd-sa-iam.sh --project-id my-other-project

set -euo pipefail

PROJECT_ID="lifting-logbook-prod"

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
    --project-id) PROJECT_ID="$2"; shift 2 ;;
    --help|-h)    usage; exit 0 ;;
    -*)           echo "Unknown flag: $1" >&2; exit 2 ;;
    *)            echo "Unexpected argument: $1" >&2; exit 2 ;;
  esac
done

SA_EMAIL="${PROJECT_ID}-cicd@${PROJECT_ID}.iam.gserviceaccount.com"
STATE_BUCKET="${PROJECT_ID}-tfstate"

command -v gcloud >/dev/null \
  || { echo "gcloud not found. See https://cloud.google.com/sdk/docs/install" >&2; exit 1; }

ACTIVE_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null || true)
[[ -n "$ACTIVE_ACCOUNT" ]] \
  || { echo "No active gcloud account. Run: gcloud auth login" >&2; exit 1; }
echo "Authenticated as: $ACTIVE_ACCOUNT"
echo "Target project:   $PROJECT_ID"
echo "Target SA:        $SA_EMAIL"
echo "Target bucket:    gs://$STATE_BUCKET"
echo ""

# Confirm the SA exists. If it does not, terraform has not been applied yet —
# this script is a no-op until the SA is created by the first terraform apply.
if ! gcloud iam service-accounts describe "$SA_EMAIL" --project="$PROJECT_ID" >/dev/null 2>&1; then
  echo "ERROR: service account $SA_EMAIL not found in project $PROJECT_ID." >&2
  echo "Run Step 5 of docs/deploy-single-user.md first (the local terraform apply)." >&2
  exit 1
fi

echo "==> Granting roles/storage.objectAdmin on gs://$STATE_BUCKET ..."
gcloud storage buckets add-iam-policy-binding "gs://$STATE_BUCKET" \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/storage.objectAdmin" \
  --project="$PROJECT_ID" \
  --condition=None >/dev/null

echo "==> Granting roles/editor on project $PROJECT_ID ..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/editor" \
  --condition=None >/dev/null

echo "==> Granting roles/resourcemanager.projectIamAdmin on project $PROJECT_ID ..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/resourcemanager.projectIamAdmin" \
  --condition=None >/dev/null

echo ""
echo "Done. The CI/CD service account now has the IAM roles required for"
echo "terraform apply to run from GitHub Actions."
echo ""
echo "Push any commit to main (or re-run the most recent failed Deploy run)"
echo "to trigger a fresh deploy."
