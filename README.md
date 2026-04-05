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

### Install

```sh
npm install
```

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
