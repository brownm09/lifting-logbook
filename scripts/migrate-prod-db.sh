#!/usr/bin/env bash
#
# migrate-prod-db.sh — Apply database migrations to the lifting-logbook production Cloud SQL instance.
#
# The production Cloud SQL instance has no public IP. This script temporarily enables
# a public IP (required for the Cloud SQL Auth Proxy to connect from a local machine),
# runs all migrations, then removes the public IP. The proxy still requires Google IAM
# authentication throughout, so the temporary exposure is protected.
#
# Starts the Cloud SQL Auth Proxy, retrieves DATABASE_URL from Secret Manager,
# runs the raw SQL migration, then runs prisma migrate deploy. Downloads the
# Cloud SQL Auth Proxy automatically if not found on PATH or in the script directory.
#
# Prereqs:
#   * gcloud CLI authenticated: `gcloud auth login` AND `gcloud auth application-default login`
#   * npm workspaces installed: `npm install` from repo root (provides the `pg` package)
#   * roles/cloudsql.client on the project (project owner has this by default)
#
# Usage:
#   ./scripts/migrate-prod-db.sh [--project-id <id>]
#
# Examples:
#   ./scripts/migrate-prod-db.sh
#   ./scripts/migrate-prod-db.sh --project-id my-other-project

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TF_DIR="$REPO_ROOT/infra/terraform"

PROJECT_ID="lifting-logbook-prod"
REGION="us-central1"
PROXY_PORT=5433
PUBLIC_IP_ENABLED=false

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

# ─── Prereq checks ────────────────────────────────────────────────────────────

command -v gcloud >/dev/null \
  || { echo "gcloud not found. See https://cloud.google.com/sdk/docs/install" >&2; exit 1; }

ACTIVE_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null || true)
[[ -n "$ACTIVE_ACCOUNT" ]] \
  || { echo "No active gcloud account. Run: gcloud auth login && gcloud auth application-default login" >&2; exit 1; }
echo "Authenticated as: $ACTIVE_ACCOUNT"

# ─── Cloud SQL Auth Proxy ─────────────────────────────────────────────────────

PROXY_BIN=""
if command -v cloud-sql-proxy >/dev/null; then
  PROXY_BIN="cloud-sql-proxy"
elif [[ -x "$SCRIPT_DIR/cloud-sql-proxy" ]]; then
  PROXY_BIN="$SCRIPT_DIR/cloud-sql-proxy"
else
  echo "==> cloud-sql-proxy not found — downloading to $SCRIPT_DIR/cloud-sql-proxy ..."
  PROXY_VERSION="v2.21.3"
  OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
  ARCH="$(uname -m)"
  # Filename convention differs by OS:
  # Windows: cloud-sql-proxy.x64.exe / .arm64.exe
  # Linux/macOS: cloud-sql-proxy.<os>.<arch>
  case "$OS" in
    linux)                OS_SLUG="linux" ;;
    darwin)               OS_SLUG="darwin" ;;
    mingw*|msys*|cygwin*) OS_SLUG="windows" ;;
    *)       echo "Unsupported OS: $OS" >&2; exit 1 ;;
  esac
  case "$ARCH" in
    x86_64|amd64) ARCH_SLUG="amd64" ;;
    arm64|aarch64) ARCH_SLUG="arm64" ;;
    *)            echo "Unsupported arch: $ARCH" >&2; exit 1 ;;
  esac
  BASE="https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/${PROXY_VERSION}"
  if [[ "$OS_SLUG" == "windows" ]]; then
    WIN_ARCH="${ARCH_SLUG/amd64/x64}"
    PROXY_URL="${BASE}/cloud-sql-proxy.${WIN_ARCH}.exe"
  else
    PROXY_URL="${BASE}/cloud-sql-proxy.${OS_SLUG}.${ARCH_SLUG}"
  fi
  curl -fsSL -o "$SCRIPT_DIR/cloud-sql-proxy" "$PROXY_URL"
  chmod +x "$SCRIPT_DIR/cloud-sql-proxy"
  PROXY_BIN="$SCRIPT_DIR/cloud-sql-proxy"
  echo "    Downloaded to $PROXY_BIN"
fi

# ─── Get Cloud SQL instance name from terraform output ────────────────────────

echo "==> Getting Cloud SQL instance name from terraform output ..."
cd "$TF_DIR"
terraform init -backend-config="bucket=${PROJECT_ID}-tfstate" -reconfigure -input=false >/dev/null 2>&1
terraform workspace select production >/dev/null 2>&1
INSTANCE_NAME=$(terraform output -raw database_instance_name)
INSTANCE_CONNECTION_NAME="${PROJECT_ID}:${REGION}:${INSTANCE_NAME}"
echo "    Instance: $INSTANCE_CONNECTION_NAME"

# ─── Temporarily enable public IP (required for proxy from local machine) ─────
#
# The Cloud SQL Auth Proxy requires a public IP to connect from outside GCP's VPC.
# We enable it, run migrations, then remove it. The proxy still requires IAM auth
# throughout — the public IP alone does not grant database access.

echo "==> Enabling temporary public IP on Cloud SQL instance ..."
gcloud sql instances patch "$INSTANCE_NAME" \
  --assign-ip \
  --project="$PROJECT_ID" \
  --quiet
PUBLIC_IP_ENABLED=true
echo "    Waiting for instance to be ready ..."
until gcloud sql instances describe "$INSTANCE_NAME" \
  --project="$PROJECT_ID" \
  --format="value(state)" 2>/dev/null | grep -q "RUNNABLE"; do
  echo "    Instance not ready yet, retrying in 5s ..."
  sleep 5
done
echo "    Instance ready. Waiting an additional 15s for IP to become routable ..."
sleep 15

remove_public_ip() {
  if $PUBLIC_IP_ENABLED; then
    echo "==> Removing temporary public IP from Cloud SQL instance ..."
    gcloud sql instances patch "$INSTANCE_NAME" \
      --no-assign-ip \
      --project="$PROJECT_ID" \
      --quiet \
      || echo "WARNING: Failed to remove public IP — remove manually: gcloud sql instances patch $INSTANCE_NAME --no-assign-ip --project=$PROJECT_ID"
  fi
}

# ─── Get DATABASE_URL from Secret Manager ────────────────────────────────────

echo "==> Retrieving DATABASE_URL from Secret Manager ..."
RAW_DB_URL=$(gcloud secrets versions access latest \
  --secret="${PROJECT_ID}-database-url" \
  --project="$PROJECT_ID")

# Proxy listens on localhost:$PROXY_PORT — rewrite host/port in the URL
PROXY_DB_URL=$(echo "$RAW_DB_URL" | sed -E "s|@[^/]+/|@127.0.0.1:${PROXY_PORT}/|")

# ─── Start proxy ─────────────────────────────────────────────────────────────

echo "==> Starting Cloud SQL Auth Proxy on port $PROXY_PORT ..."
"$PROXY_BIN" "${INSTANCE_CONNECTION_NAME}?port=${PROXY_PORT}" &
PROXY_PID=$!
trap 'echo "==> Stopping proxy (PID $PROXY_PID)"; kill "$PROXY_PID" 2>/dev/null || true; remove_public_ip' EXIT

# Give the proxy a moment to establish the connection
sleep 3

# ─── Run migrations ───────────────────────────────────────────────────────────

# user_data_source is managed outside Prisma (infra/migrations/).
# If it exists from a previous run, drop it so prisma migrate deploy sees an empty DB.
# The app user owns this table, so it has permission to drop it.
echo "==> Clearing any pre-existing user_data_source table ..."
node -e "
  const { Client } = require('pg');
  const client = new Client({ connectionString: process.argv[1] });
  client.connect()
    .then(() => client.query('DROP TABLE IF EXISTS user_data_source'))
    .then(() => { console.log('    Done.'); client.end(); })
    .catch(err => { console.error(err.message); client.end(); process.exit(1); });
" "$PROXY_DB_URL"

# prisma migrate deploy applies all pending migrations in order.
# It requires an empty database (or one that already has the _prisma_migrations table).
echo "==> Running prisma migrate deploy (14 migrations) ..."
cd "$REPO_ROOT/apps/api"
DATABASE_URL="$PROXY_DB_URL" npx prisma migrate deploy
echo "    Done."

# Run infra migration after Prisma — user_data_source is not in the Prisma schema.
echo "==> Running infra/migrations/001_create_user_data_source.sql ..."
SQL_FILE="$(cygpath -w "$REPO_ROOT/infra/migrations/001_create_user_data_source.sql" 2>/dev/null \
  || echo "$REPO_ROOT/infra/migrations/001_create_user_data_source.sql")"
node -e "
  const { Client } = require('pg');
  const fs = require('fs');
  const sql = fs.readFileSync(process.argv[1], 'utf8');
  const client = new Client({ connectionString: process.argv[2] });
  client.connect()
    .then(() => client.query(sql))
    .then(() => { console.log('    Done.'); client.end(); })
    .catch(err => { console.error(err.message); client.end(); process.exit(1); });
" "$SQL_FILE" "$PROXY_DB_URL"

echo ""
echo "All migrations applied successfully."
