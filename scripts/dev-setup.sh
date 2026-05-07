#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# ── Colours ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}!${NC} $*"; }
die()  { echo -e "${RED}✗${NC} $*" >&2; exit 1; }
step() { echo -e "\n${GREEN}▶${NC} $*"; }

echo "Lifting Logbook — local dev setup"
echo "==================================="

# ── 1. Prerequisites ──────────────────────────────────────────────────────────
step "Checking prerequisites"

node_version=$(node --version 2>/dev/null | sed 's/v//' || echo "0")
node_major=$(echo "$node_version" | cut -d. -f1)
[[ "$node_major" -ge 20 ]] || die "Node.js >= 20 required (found v${node_version}). Run: nvm use"
ok "Node.js v${node_version}"

docker info &>/dev/null || die "Docker is not running. Start Docker Desktop and re-run this script."
ok "Docker"

docker compose version &>/dev/null || die "docker compose plugin not found."
ok "docker compose"

# ── 2. npm install ────────────────────────────────────────────────────────────
step "Installing npm dependencies"
if [[ ! -d node_modules ]]; then
  npm install
else
  ok "node_modules exists — skipping (run 'npm install' manually if packages changed)"
fi

# ── 3. Env files ──────────────────────────────────────────────────────────────
step "Setting up env files"

setup_env() {
  local src="$1" dst="$2" label="$3"
  if [[ -f "$dst" ]]; then
    ok "$label already exists — leaving unchanged"
  else
    cp "$src" "$dst"
    ok "$label created from example"
  fi
}

setup_env apps/api/.env.example  apps/api/.env  "apps/api/.env"
setup_env apps/web/.env.example  apps/web/.env  "apps/web/.env"

# Patch DATABASE_URL in apps/api/.env if it still has the placeholder
if grep -q 'USER:PASSWORD@HOST' apps/api/.env 2>/dev/null; then
  if [[ "$(uname -s)" == "Darwin" ]]; then
    sed -i '' \
      's|DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/lifting_logbook|DATABASE_URL=postgresql://postgres:postgres@localhost:5432/lifting_logbook|' \
      apps/api/.env
    sed -i '' \
      's|SYSTEM_DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/lifting_logbook_system|SYSTEM_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/lifting_logbook|' \
      apps/api/.env
  else
    sed -i \
      's|DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/lifting_logbook|DATABASE_URL=postgresql://postgres:postgres@localhost:5432/lifting_logbook|' \
      apps/api/.env
    sed -i \
      's|SYSTEM_DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/lifting_logbook_system|SYSTEM_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/lifting_logbook|' \
      apps/api/.env
  fi
  ok "DATABASE_URL patched with local postgres credentials"
fi

# ── 4. Start Postgres ─────────────────────────────────────────────────────────
step "Starting Postgres"
docker compose up db -d

# Wait until Postgres accepts connections (up to 30s)
echo -n "  Waiting for Postgres to be ready"
for i in $(seq 1 30); do
  if docker compose exec -T db pg_isready -U postgres &>/dev/null; then
    echo ""
    ok "Postgres is ready"
    break
  fi
  echo -n "."
  sleep 1
  if [[ $i -eq 30 ]]; then
    echo ""
    die "Postgres did not become ready in 30 seconds."
  fi
done

# ── 5. Run migrations ─────────────────────────────────────────────────────────
step "Running database migrations"
(cd apps/api && npx prisma migrate dev --name init 2>&1 | grep -v "^$" || true)
ok "Migrations applied"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}Setup complete.${NC}"
echo ""
echo "Start the dev servers:"
echo "  npm run dev"
echo ""
echo "Then open:"
echo "  Web → http://localhost:3000"
echo "  API → http://localhost:3004"
echo ""
warn "No Clerk account needed — DevAuthProvider handles auth automatically in local dev."
