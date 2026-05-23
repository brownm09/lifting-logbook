#!/usr/bin/env bash
#
# migrate-staging-db.sh — Apply database migrations to the lifting-logbook staging Cloud SQL instance.
#
# Differences from migrate-prod-db.sh:
#   * PROJECT_ID=lifting-logbook-staging
#   * PROXY_PORT=5434 (avoids conflict if the prod proxy is also running on 5433)
#   * terraform workspace select staging
#   * State bucket: lifting-logbook-tfstate (prefix=terraform/state) — staging uses
#     the shared tfstate bucket, unlike prod which has its own lifting-logbook-prod-tfstate
#   * Secret names use the -stg- suffix pattern (lifting-logbook-stg-database-url)
#     rather than the full project name (${PROJECT_ID}-database-url)
#   * PROXY_DB_URL has sslmode=disable appended (required for Prisma via Cloud SQL Auth Proxy)
#
# The staging Cloud SQL instance has no public IP. This script temporarily enables
# a public IP (required for the Cloud SQL Auth Proxy to connect from a local machine),
# scoped to the operator's current IP via --authorized-networks, runs all migrations,
# then removes the public IP. The proxy still requires Google IAM authentication
# throughout, so the temporary exposure is double-protected.
#
# On re-runs (e.g., to apply new Prisma migrations after the initial bootstrap), the
# DROP TABLE step is skipped automatically when _prisma_migrations already exists,
# preserving any existing user_data_source rows.
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
#   ./scripts/migrate-staging-db.sh [--project-id <id>] [--region <region>]
#
# Examples:
#   ./scripts/migrate-staging-db.sh
#   ./scripts/migrate-staging-db.sh --project-id my-other-project

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TF_DIR="$REPO_ROOT/infra/terraform"

PROJECT_ID="lifting-logbook-staging"
REGION="us-central1"
PROXY_PORT=5434
PUBLIC_IP_ENABLED=false
PROXY_PID=""

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
    --region)     REGION="$2"; shift 2 ;;
    --help|-h)    usage; exit 0 ;;
    -*)           echo "Unknown flag: $1" >&2; exit 2 ;;
    *)            echo "Unexpected argument: $1" >&2; exit 2 ;;
  esac
done

# ─── Cleanup function (defined early so the trap can reference it) ─────────────

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

# Install cleanup trap before any destructive operations so the public IP is always
# removed even if the script is interrupted (Ctrl-C, set -e, early exit).
# PROXY_PID is initialized to "" above; guard ensures kill only fires after proxy starts.
trap '[[ -n "${PROXY_PID:-}" ]] && { echo "==> Stopping proxy (PID $PROXY_PID)"; kill "$PROXY_PID" 2>/dev/null || true; }; remove_public_ip' EXIT INT TERM

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
elif [[ -x "$SCRIPT_DIR/cloud-sql-proxy.exe" ]]; then
  # Windows binary (downloaded with correct .exe extension)
  PROXY_BIN="$SCRIPT_DIR/cloud-sql-proxy.exe"
elif [[ -x "$SCRIPT_DIR/cloud-sql-proxy" ]]; then
  PROXY_BIN="$SCRIPT_DIR/cloud-sql-proxy"
else
  echo "==> cloud-sql-proxy not found — downloading ..."
  PROXY_VERSION="v2.21.3"
  OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
  ARCH="$(uname -m)"
  # Filename convention differs by OS:
  # Windows: cloud-sql-proxy.x64.exe / .arm64.exe  (saved with .exe extension)
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
    PROXY_PATH="$SCRIPT_DIR/cloud-sql-proxy.exe"
  else
    PROXY_URL="${BASE}/cloud-sql-proxy.${OS_SLUG}.${ARCH_SLUG}"
    PROXY_PATH="$SCRIPT_DIR/cloud-sql-proxy"
  fi
  curl -fsSL -o "$PROXY_PATH" "$PROXY_URL"
  chmod +x "$PROXY_PATH"
  PROXY_BIN="$PROXY_PATH"
  echo "    Downloaded to $PROXY_BIN"
fi

# ─── Get Cloud SQL instance name from terraform output ────────────────────────

echo "==> Getting Cloud SQL instance name from terraform output ..."
cd "$TF_DIR"
terraform init -backend-config="bucket=lifting-logbook-tfstate" -backend-config="prefix=terraform/state" -reconfigure -input=false >/dev/null 2>&1
terraform workspace select staging >/dev/null 2>&1
INSTANCE_NAME=$(terraform output -raw database_instance_name)
INSTANCE_CONNECTION_NAME="${PROJECT_ID}:${REGION}:${INSTANCE_NAME}"
echo "    Instance: $INSTANCE_CONNECTION_NAME"

# ─── Temporarily enable public IP (required for proxy from local machine) ─────
#
# The Cloud SQL Auth Proxy requires a public IP to connect from outside GCP's VPC.
# We enable it scoped to the operator's current IP, run migrations, then remove it.
# The proxy still requires IAM auth — the public IP alone does not grant DB access.

echo "==> Enabling temporary public IP on Cloud SQL instance ..."
OPERATOR_IP=$(curl -fsSL api4.ipify.org 2>/dev/null || curl -fsSL ifconfig.me 2>/dev/null || echo "")
# Validate IPv4 -- Cloud SQL authorized-networks rejects IPv6; the gcloud error is not obvious
if [[ -n "$OPERATOR_IP" ]] && ! [[ "$OPERATOR_IP" =~ ^[0-9]+[.][0-9]+[.][0-9]+[.][0-9]+$ ]]; then
  echo "WARNING: Detected non-IPv4 address ($OPERATOR_IP) -- skipping authorized_networks restriction." >&2
  OPERATOR_IP=""
fi
if [[ -n "$OPERATOR_IP" ]]; then
  echo "    Scoping authorized_networks to operator IP: $OPERATOR_IP/32"
  gcloud sql instances patch "$INSTANCE_NAME" \
    --assign-ip \
    --authorized-networks="$OPERATOR_IP/32" \
    --project="$PROJECT_ID" \
    --quiet
else
  echo "WARNING: Could not detect operator IP — public IP enabled without authorized_networks restriction." >&2
  gcloud sql instances patch "$INSTANCE_NAME" \
    --assign-ip \
    --project="$PROJECT_ID" \
    --quiet
fi
PUBLIC_IP_ENABLED=true

echo "    Waiting for instance to be ready ..."
until gcloud sql instances describe "$INSTANCE_NAME" \
  --project="$PROJECT_ID" \
  --format="value(state)" 2>/dev/null | grep -q "RUNNABLE"; do
  echo "    Instance not ready yet, retrying in 5s ..."
  sleep 5
done
echo "    Instance ready. Waiting an additional 30s for proxy port 3307 to become routable ..."
sleep 30

# ─── Get DATABASE_URL from Secret Manager ────────────────────────────────────

echo "==> Retrieving DATABASE_URL from Secret Manager ..."
RAW_DB_URL=$(gcloud secrets versions access latest \
  --secret="lifting-logbook-stg-database-url" \
  --project="$PROJECT_ID")

# Proxy listens on localhost:$PROXY_PORT — rewrite host/port in the URL
PROXY_DB_URL=$(echo "$RAW_DB_URL" | sed -E "s|@[^/]+/|@127.0.0.1:${PROXY_PORT}/|")
# Cloud SQL Auth Proxy handles TLS -- strip any existing sslmode, then force disable for Prisma.
# Two-pass replace: first promote the next param to ? when sslmode is the leading param,
# then strip any remaining sslmode= occurrence. This avoids a malformed URL when
# sslmode is the first query param but not the only one (e.g. ?sslmode=require&sslrootcert=...).
PROXY_DB_URL=$(node -e "var u=process.argv[1].replace(/[?]sslmode=[^&]*&/,'?').replace(/[?&]sslmode=[^&]*/g,''); console.log(u+(u.indexOf('?')>=0?'&':'?')+'sslmode=disable')" "$PROXY_DB_URL")

# ─── Start proxy ─────────────────────────────────────────────────────────────

echo "==> Starting Cloud SQL Auth Proxy on port $PROXY_PORT ..."
"$PROXY_BIN" "${INSTANCE_CONNECTION_NAME}?port=${PROXY_PORT}" &
PROXY_PID=$!

# Poll until proxy is accepting connections (up to 30s) rather than using a fixed sleep.
echo "==> Waiting for proxy to be ready ..."
WAIT_LIMIT=30
WAIT_COUNT=0
until node -e "require('net').createConnection(${PROXY_PORT},'127.0.0.1').on('connect',()=>process.exit(0)).on('error',()=>process.exit(1))" 2>/dev/null; do
  WAIT_COUNT=$((WAIT_COUNT + 1))
  if [[ $WAIT_COUNT -ge $WAIT_LIMIT ]]; then
    echo "Proxy not ready after ${WAIT_LIMIT}s — giving up." >&2; exit 1
  fi
  sleep 1
done
echo "    Proxy ready."

# ─── Run migrations ───────────────────────────────────────────────────────────

# Check whether Prisma migrations have already been applied.
# If _prisma_migrations exists this is a re-run — skip the DROP TABLE to preserve data.
echo "==> Checking migration state ..."
MIGRATIONS_EXIST=$(node -e "
  const { Client } = require('pg');
  const client = new Client({ connectionString: process.argv[1] });
  client.connect()
    .then(() => client.query(\"SELECT to_regclass('public._prisma_migrations')\"))
    .then(r => { console.log(r.rows[0].to_regclass ? 'yes' : 'no'); client.end(); })
    .catch(err => { console.error(err.message); client.end(); process.exit(1); });
" "$PROXY_DB_URL")

if [[ "$MIGRATIONS_EXIST" == "no" ]]; then
  # user_data_source is managed outside Prisma (infra/migrations/).
  # On a fresh database it may exist from a prior partial run — drop it so
  # prisma migrate deploy sees a clean state. The app user owns this table.
  echo "==> Fresh database — clearing any pre-existing user_data_source table ..."
  node -e "
    const { Client } = require('pg');
    const client = new Client({ connectionString: process.argv[1] });
    client.connect()
      .then(() => client.query('DROP TABLE IF EXISTS user_data_source'))
      .then(() => { console.log('    Done.'); client.end(); })
      .catch(err => { console.error(err.message); client.end(); process.exit(1); });
  " "$PROXY_DB_URL"
else
  echo "    Migrations already applied — skipping user_data_source drop (preserving existing data)."
fi

# prisma migrate deploy applies all pending migrations in order.
# It requires an empty database (or one that already has the _prisma_migrations table).
echo "==> Running prisma migrate deploy ..."
cd "$REPO_ROOT/apps/api"
DATABASE_URL="$PROXY_DB_URL" npx prisma migrate deploy
echo "    Done."

# Run infra migration after Prisma — user_data_source is not in the Prisma schema.
# Uses CREATE TABLE IF NOT EXISTS, so it is idempotent on re-runs.
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
