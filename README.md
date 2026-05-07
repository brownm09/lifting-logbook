# Lifting Logbook

> **Origin:** This repository is a cloud-native evolution of
> [brownm09/gas-lifting-logbook](https://github.com/brownm09/gas-lifting-logbook),
> a Google Apps Script application backed by Google Sheets. The domain logic in
> `packages/core` is migrated directly from that codebase; the GAS-specific API
> layer is replaced by the apps in this monorepo.

A cloud-native strength training tracker built as a Turborepo monorepo.

For full architecture context, decision records, and project goals see **[docs/README.md](docs/README.md)**.

---

## Repository Structure

```
lifting-logbook/
  packages/
    core/
      src/         # Pure domain logic — services, models, parsers, mappers
      tests/       # Unit tests co-located with the package
    types/
      src/         # Shared TypeScript interfaces and API contracts
  apps/
    api/
      src/         # NestJS API server (primary)
      tests/       # Integration and unit tests co-located with the app
    api-legacy/
      src/         # Express API server (legacy comparison)
      tests/
    web/
      app/         # Next.js App Router frontend
    mobile/        # React Native (Expo) mobile client
  infra/
    kubernetes/    # GKE Autopilot manifests and Helm charts
    cloud-run/     # Cloud Run service YAML
    terraform/     # Shared infrastructure: VPC, load balancer, DNS, IAM
  docs/
    adr/           # Architecture Decision Records
    README.md      # Project context and architecture overview
  scripts/         # Repository automation scripts
```

Tests are co-located with each package and app rather than in a top-level `tests/`
directory. This keeps each workspace self-contained — `turbo run test --filter=@logbook/core`
runs only core's tests, with no knowledge of the rest of the monorepo.

---

## Getting Started

### Prerequisites

- Node.js >= 20.11.1 (use `.nvmrc`: `nvm use`)
- npm >= 10 (bundled with Node 20)
- Docker (for local Postgres)

### Local Development

```sh
# 1. Install dependencies
npm install

# 2. Start Postgres
docker compose up db -d

# 3. Create env files from examples
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Edit `apps/api/.env` and set:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/lifting_logbook
# Leave CLERK_SECRET_KEY unset — DevAuthProvider is used automatically
DEV_USER_ID=dev-user
DEV_USER_EMAIL=dev@example.com
```

Edit `apps/web/.env` and set:
```
API_URL=http://localhost:3004
NEXT_PUBLIC_API_URL=http://localhost:3004
NEXT_PUBLIC_DEFAULT_PROGRAM=5-3-1
DEV_AUTH_TOKEN=dev-user
NEXT_PUBLIC_DEV_AUTH_TOKEN=dev-user
```

```sh
# 4. Apply database migrations
cd apps/api && npx prisma migrate dev && cd ../..

# 5. Start all dev servers
npm run dev
```

- Web: http://localhost:3000
- API: http://localhost:3004

### Common Commands

| Command | Description |
|---|---|
| `npm run build` | Build all packages and apps |
| `npm run test` | Run all tests |
| `npm run lint` | Lint all packages and apps |
| `npm run dev` | Start all apps in development mode |

All commands are orchestrated by [Turborepo](https://turbo.build) and only rebuild/retest
packages affected by your changes.

---

## Architecture

This project follows a hexagonal architecture (Ports & Adapters). Domain logic in `packages/core`
has no dependency on infrastructure. All external concerns (data stores, auth providers, HTTP
transport) are accessed through defined interfaces and implemented as swappable adapters.

See [docs/README.md](docs/README.md) for the full architectural narrative and a table of all
Architecture Decision Records.
