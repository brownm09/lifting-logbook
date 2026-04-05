# Lifting Logbook

A cloud-native strength training tracker built as a Turborepo monorepo.

For full architecture context, decision records, and project goals see **[docs/README.md](docs/README.md)**.

---

## Repository Structure

```
lifting-logbook/
  packages/
    core/          # Pure domain logic — services, models, parsers, mappers
    types/         # Shared TypeScript interfaces and API contracts
  apps/
    api/           # NestJS API server (primary)
    api-legacy/    # Express API server (legacy comparison)
    web/           # Next.js App Router frontend
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

---

## Getting Started

### Prerequisites

- Node.js >= 18
- npm >= 8 (workspaces support)

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
