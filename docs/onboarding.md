# Developer Onboarding Guide

A guided walkthrough from clone to first PR. This document sequences the existing documentation
and fills the gaps between them — it does not duplicate content covered elsewhere.

---

## Prerequisites

Before you begin, install:

- **Node.js 20.11.1** — use [nvm](https://github.com/nvm-sh/nvm) (macOS/Linux) or
  [nvm-windows](https://github.com/coreybutler/nvm-windows) (Windows). The repo ships a
  `.nvmrc`; run `nvm use $(cat .nvmrc)` from the repo root to activate the right version.
- **npm 10** — bundled with Node 20; no separate install needed.
- **Docker Desktop** — runs the local Postgres database and the full observability stack
  (Grafana, Tempo, Loki, Prometheus).
- **Git**

> **Windows:** Use WSL2 or Git Bash for all terminal commands. PowerShell handles arrays and
> arithmetic differently and has caused failures in this environment.

---

## Clone & Bootstrap

> **Automated setup:** After cloning, you can run `scripts/dev-setup.sh` instead of the
> manual steps below. The script checks prerequisites (Node ≥ 20, Docker), installs npm
> dependencies, copies `.env.example` files, and runs Prisma migrations.
>
> ```sh
> bash scripts/dev-setup.sh
> ```
>
> The manual steps are kept below for reference or if you prefer to run each step individually.

```sh
git clone https://github.com/merickvaughn/lifting-logbook.git
cd lifting-logbook

# Pick up the correct Node version
nvm use $(cat .nvmrc)

# Install all workspace dependencies
npm install

# Start the full stack: Postgres, OTel Collector, Tempo, Loki, Prometheus, Grafana
docker compose up -d

# Copy env files and fill in values
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Edit `apps/api/.env`:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/lifting_logbook
# Leave CLERK_SECRET_KEY unset — DevAuthProvider is used automatically in local dev
DEV_USER_ID=dev-user
DEV_USER_EMAIL=dev@example.com
```

Edit `apps/web/.env`:

```
API_URL=http://localhost:3004
PUBLIC_API_URL=http://localhost:3004
DEFAULT_PROGRAM=5-3-1
DEV_AUTH_TOKEN=dev-user
```

```sh
# Apply database migrations
cd apps/api && npx prisma migrate dev && cd ../..

# Start all dev servers
npm run dev
```

**Running services:**

| Service | URL |
|---------|-----|
| Web | http://localhost:3000 |
| API | http://localhost:3004 |
| Grafana | http://localhost:3030 (no login required locally) |

For the full Getting Started reference — including common commands and the Turborepo pipeline —
see [README.md](../README.md).

---

## Architecture Mental Model

The codebase follows **hexagonal architecture (Ports & Adapters)**. Domain logic in
`packages/core` has zero infrastructure dependencies; all external concerns (data stores,
auth providers, HTTP transport) are accessed through defined interfaces and implemented as
swappable adapters. Understanding this pattern is the most important thing you can do before
writing your first line of code here.

For the full narrative, technology choices, and diagram index see [docs/README.md](README.md).

### Recommended ADR Reading Order

Read these five ADRs before touching code. Each is short and self-contained:

1. [ADR-001 — Monorepo Structure with Turborepo](adr/ADR-001-monorepo-structure.md) — explains
   the workspace layout and why packages are split the way they are
2. [ADR-002 — Hexagonal Architecture (Ports and Adapters)](adr/ADR-002-ports-and-adapters.md) —
   the core design pattern; everything else depends on understanding this
3. [ADR-003 — Per-User Data Store Configuration](adr/ADR-003-per-user-data-store-config.md) —
   explains how the correct adapter is resolved per request
4. [ADR-004 — Multi-Data-Store Adapter Strategy](adr/ADR-004-multi-data-store-adapters.md) —
   explains why both Google Sheets and Postgres coexist as backends
5. [ADR-013 — Testing Strategy](adr/ADR-013-testing-strategy.md) — explains how tests are
   organized and what the coverage expectations are

If you are working on the API layer, also read:

- [ADR-005 — Authentication Strategy](adr/ADR-005-authentication-strategy.md) — how Clerk,
  Auth0, and the local `DevAuthProvider` relate to each other
- [ADR-011 — API Server — NestJS Primary with Express Legacy Comparison](adr/ADR-011-api-server-nestjs-and-express.md) —
  why there are two API apps and how they relate

---

## Making Your First Change

1. **Open an issue first.** Every code change starts with a GitHub issue describing the problem
   or goal — not the implementation. See [CONTRIBUTING.md](../CONTRIBUTING.md) for the full
   workflow.
2. **Create a branch** using the naming convention in CONTRIBUTING.md
   (`feat/issue-<N>-<slug>`, `fix/issue-<N>-<slug>`, etc.).
3. **Make your changes**, following the commit message format in CONTRIBUTING.md.
4. **Run the tests** (see below) and confirm they pass before pushing.
5. **Open a PR** — the title format and merge strategy are in CONTRIBUTING.md.

For significant new features or architectural changes, use the `/propose` skill before opening
an issue. It guides you through clarifying questions and produces a proposal doc.

---

## Running Tests

```sh
# Full suite across all workspaces
npm test

# Single workspace
npm test -w @lifting-logbook/core
npm test -w @lifting-logbook/api
npm test -w @lifting-logbook/web
```

> **Note:** `@lifting-logbook/web` has a pre-existing test environment issue (`jest-environment-jsdom` not installed). That failure is safe to ignore — `core` and `api` are the meaningful signal.

Run `npm run build` first if you have touched compiled output (e.g., API controllers, shared
types in `packages/types`). Integration tests that hit the database require `DATABASE_URL` to
be set in `apps/api/.env`.

---

## Troubleshooting

### 1. Missing environment variables

**Symptom:** `Error: DATABASE_URL is not set` or auth errors on startup.

**Fix:** Make sure you copied `.env.example` in both `apps/api/` and `apps/web/` and filled
in the required values (see Bootstrap above). The API will not start without `DATABASE_URL`.

### 2. Postgres not running

**Symptom:** `Connection refused` on port 5432 or Prisma migration fails with a network error.

**Fix:**

```sh
docker compose up db -d
```

Wait a few seconds for Postgres to finish initializing, then retry migrations.

### 3. Node version mismatch

**Symptom:** Build errors, missing peer dependency warnings, or package resolution failures
that look unrelated to your changes.

**Fix:**

```sh
nvm use $(cat .nvmrc)  # activates Node 20.11.1 (nvm-windows requires explicit version)
npm install
```

If `nvm` is not installed, upgrade your system Node to ≥ 20.11.1.

### Deeper debugging

The full observability stack (Grafana at http://localhost:3030) gives you traces, logs, and
metrics for local requests. See [docs/runbooks/observability.md](runbooks/observability.md)
for startup, trace queries, and log↔trace correlation.

---

## Where to Go Next

| Resource | What it covers |
|----------|----------------|
| [docs/README.md](README.md) | Full architecture narrative, ADR index, diagram index |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Branch workflow, commit format, PR conventions |
| [docs/deploy.md](deploy.md) | First-time cloud infrastructure setup (GCP, Terraform, Clerk) |
| [docs/security-review-checklist.md](security-review-checklist.md) | Pre-ship security checklist |
| [docs/operations/observability-onboarding.md](operations/observability-onboarding.md) | Observability & on-call start-here: reading logs/dashboards/traces and joining the rotation |
| [docs/runbooks/](runbooks/) | Incident response guides and operational runbooks |
| [docs/PRD.md](PRD.md) | Product requirements, user personas, success metrics |
