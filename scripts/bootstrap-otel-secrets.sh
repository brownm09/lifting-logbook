#!/usr/bin/env bash
#
# bootstrap-otel-secrets.sh — Populate the Grafana Cloud auth-header secrets the OTel
# Collector needs (issue #474). Prompts the operator for the Grafana Cloud instance IDs
# and API token, builds the `Basic <base64(instanceId:token)>` headers locally, and writes
# them as new versions of the Secret Manager secrets the deploy pipeline reads.
#
# The token is read with a HIDDEN prompt and never printed, never written to disk, and
# never passed on the command line — it lives only in this process's memory and is piped
# straight into `gcloud secrets versions add --data-file=-`.
#
# Single shared Grafana Cloud stack (free tier): staging and production reuse the SAME
# instance IDs + token, so the same header values are written to both envs' secret names.
# (If you later split to separate stacks, run with --env staging / --env production and
# supply that stack's values each time — see #487 / docs/deploy.md.)
#
# Secrets written (per env):
#   <prefix>-otel-otlp-auth-header   ← Basic base64(OTLP instanceId:token)   (traces + metrics → Tempo/Mimir)
#   <prefix>-otel-loki-auth-header   ← Basic base64(Loki instanceId:token)   (logs → Loki)
# where <prefix> is lifting-logbook-stg (staging) / lifting-logbook-prod (production) —
# note the secret-name prefix uses "stg", while the staging GCP *project* is
# "lifting-logbook-staging". They are intentionally different.
#
# The secret CONTAINERS are created by `terraform apply` (infra/terraform/main.tf) with a
# REPLACE_ME placeholder. Run this AFTER that apply: it adds a real version and leaves the
# placeholder as an older version (CI reads :latest). If a secret does not exist yet, the
# script stops and tells you to apply Terraform first — or pass --create to make it ad-hoc
# (then Terraform will need a `terraform import` for that secret, so prefer applying first).
#
# Prereqs:
#   * gcloud CLI authenticated (`gcloud auth login`) with secretmanager.admin (or owner)
#     on both projects. The project owner has this by default.
#
# Usage:
#   ./scripts/bootstrap-otel-secrets.sh [--env both|staging|production] [--create] \
#       [--staging-project-id <id>] [--prod-project-id <id>]
#
# Examples:
#   ./scripts/bootstrap-otel-secrets.sh                       # both envs, secrets must already exist
#   ./scripts/bootstrap-otel-secrets.sh --env staging         # staging only
#   ./scripts/bootstrap-otel-secrets.sh --create              # also create the containers if missing

set -euo pipefail

ENVS="both"
CREATE=false
STAGING_PROJECT_ID="lifting-logbook-staging"
PROD_PROJECT_ID="lifting-logbook-prod"

usage() {
  echo "Usage: $0 [--env both|staging|production] [--create]" >&2
  echo "          [--staging-project-id <id>] [--prod-project-id <id>]" >&2
  exit "${1:-0}"
}

while [ $# -gt 0 ]; do
  case "$1" in
    --env) ENVS="$2"; shift 2 ;;
    --create) CREATE=true; shift ;;
    --staging-project-id) STAGING_PROJECT_ID="$2"; shift 2 ;;
    --prod-project-id) PROD_PROJECT_ID="$2"; shift 2 ;;
    -h|--help) usage 0 ;;
    *) echo "Unknown argument: $1" >&2; usage 1 ;;
  esac
done

case "$ENVS" in
  both|staging|production) ;;
  *) echo "ERROR: --env must be both|staging|production (got '$ENVS')" >&2; exit 1 ;;
esac

command -v gcloud >/dev/null 2>&1 || { echo "ERROR: gcloud CLI not found on PATH." >&2; exit 1; }

# Portable base64 with no line wrapping (GNU base64 -w0 isn't available on macOS).
b64() { base64 | tr -d '\n'; }

echo "This populates the Grafana Cloud auth headers for the OTel Collector."
echo "Get these from the Grafana Cloud portal → Stack → Details:"
echo "  • OTLP endpoint  → OpenTelemetry page → 'Instance ID' / 'User'  (traces + metrics)"
echo "  • Loki           → Loki page → 'User'                            (logs)"
echo "  • API token      → generate one with send metrics + logs + traces"
echo

read -r -p "OTLP (Tempo/Mimir) instance ID: " OTLP_INSTANCE_ID
read -r -p "Loki instance ID: " LOKI_INSTANCE_ID
# Hidden prompt — the token is never echoed.
read -r -s -p "Grafana Cloud API token (input hidden): " GRAFANA_TOKEN
echo

[ -n "$OTLP_INSTANCE_ID" ] || { echo "ERROR: OTLP instance ID is empty." >&2; exit 1; }
[ -n "$LOKI_INSTANCE_ID" ] || { echo "ERROR: Loki instance ID is empty." >&2; exit 1; }
[ -n "$GRAFANA_TOKEN" ] || { echo "ERROR: API token is empty." >&2; exit 1; }

OTLP_HEADER="Basic $(printf '%s:%s' "$OTLP_INSTANCE_ID" "$GRAFANA_TOKEN" | b64)"
LOKI_HEADER="Basic $(printf '%s:%s' "$LOKI_INSTANCE_ID" "$GRAFANA_TOKEN" | b64)"

# Write one secret: ensure it exists (or create with --create), then add a new version.
write_secret() {
  local project="$1" name="$2" value="$3"
  if ! gcloud secrets describe "$name" --project="$project" >/dev/null 2>&1; then
    if [ "$CREATE" = true ]; then
      echo "    creating secret $name (ad-hoc — Terraform will need a 'terraform import' for it)"
      gcloud secrets create "$name" --replication-policy=automatic --project="$project" >/dev/null
    else
      echo "ERROR: secret '$name' does not exist in project '$project'." >&2
      echo "       Run 'terraform apply' first (it creates the container), or re-run with --create." >&2
      exit 1
    fi
  fi
  printf '%s' "$value" | gcloud secrets versions add "$name" --data-file=- --project="$project" >/dev/null
  echo "    ✓ added new version to $name"
}

# Push the (shared-stack) header values to one environment's two secrets.
do_env() {
  local env="$1" project prefix
  case "$env" in
    staging)    project="$STAGING_PROJECT_ID"; prefix="lifting-logbook-stg" ;;
    production) project="$PROD_PROJECT_ID";     prefix="lifting-logbook-prod" ;;
  esac
  echo "==> $env  (project: $project)"
  write_secret "$project" "${prefix}-otel-otlp-auth-header" "$OTLP_HEADER"
  write_secret "$project" "${prefix}-otel-loki-auth-header" "$LOKI_HEADER"
}

case "$ENVS" in
  both)       do_env staging; do_env production ;;
  staging)    do_env staging ;;
  production) do_env production ;;
esac

echo
echo "Done. The next push-to-main deploy will sync these into the otel-collector-secrets"
echo "Kubernetes Secret and roll out the collector. Verify in Grafana Cloud afterward"
echo "(Tempo: { service.name = \"lifting-logbook-api\" }; Loki; Mimir http.server.* metrics)."
