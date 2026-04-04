# Project Context: Gas Lifting Logbook — Cloud-Native Evolution

## Overview

Gas Lifting Logbook is a personal strength training tracker originally built as a Google Apps
Script (GAS) application backed by Google Sheets. It implements a structured lifting program
(Reverse Pyramid Training-style periodization with 5/3/1 variants planned), tracking training maxes, cycle dashboards, workout
sheets, and lift records across multiple lifts.

This document captures the architectural context for the cloud-native evolution of the project:
a multi-user, platform-agnostic version intended for deployment on modern cloud infrastructure.

---

## History

The original application was built as a GAS project deployed against a single Google Sheets
workbook. It evolved through a `legacy/` phase (monolithic script files) into a structured
TypeScript codebase with a clean `core/` (pure domain logic) and `api/` (GAS adapter) separation.
That separation is the key asset being carried forward.

---

## Goals for the Cloud-Native Version

### Functional

- Support multiple users, each with independent data and configuration
- Provide a web UI that replaces the spreadsheet-based interface
- Provide a native mobile experience (Android-first)
- Support multiple data store backends, starting with Google Sheets and Postgres

### Non-Functional

- Demonstrate enterprise-grade architectural patterns suitable for a director of engineering
  portfolio
- Show awareness of compliance requirements (GDPR, HIPAA) even where not currently applicable
- Enable meaningful A/B comparisons across infrastructure, API style, and mobile client choices
- Maintain a clear separation between domain logic and infrastructure concerns at all times

---

## Intended Audience

This project serves two audiences simultaneously:

1. **End users** — individuals tracking their lifting program who want a polished web or mobile
   experience
2. **Technical evaluators** — engineering leaders and hiring committees assessing architectural
   depth, decision-making quality, and breadth of modern platform knowledge

[Architecture Decision Records](adr/) and this context document are written with both audiences
in mind. Technical rationale is explicit; alternatives are documented; compliance and operational
tradeoffs are surfaced even where the simpler path is chosen.

---

## Repository Structure (Cloud-Native Target)

```
monorepo/
  packages/
    core/          # Portable domain logic (services, models, parsers, mappers)
    types/         # Shared TypeScript types and API contracts
  apps/
    api/           # Node.js HTTP server (NestJS primary, Express legacy comparison)
    web/           # Next.js App Router frontend
    mobile/        # React Native (Expo) — first pass; native Kotlin to follow
  infra/
    kubernetes/    # GKE Autopilot manifests and Helm charts (primary)
    cloud-run/     # Cloud Run service YAML (A/B comparison target)
    terraform/     # Shared infrastructure: VPC, load balancer, DNS, IAM
  docs/
    adr/           # Architecture Decision Records
    README.md      # This file
```

---

## Key Architectural Principles

1. **Hexagonal architecture (Ports & Adapters):** Domain logic is isolated from infrastructure.
   All external dependencies (data stores, auth providers, transport protocols) are accessed
   through defined interfaces (ports) and implemented as swappable adapters.
   See [ADR-002](adr/ADR-002-ports-and-adapters.md).

2. **Per-user adapter resolution:** The data store adapter used for a given request is resolved
   from the authenticated user's stored configuration, not from a global deployment setting.
   This supports gradual migration and heterogeneous data store usage across users.
   See [ADR-003](adr/ADR-003-per-user-data-store-config.md).

3. **Transport-layer neutrality:** The same service layer is exposed via both REST and GraphQL.
   Neither transport has privileged access to domain logic.
   See [ADR-006](adr/ADR-006-rest-and-graphql-dual-transport.md).

4. **Infrastructure portability:** The application is containerized and can be deployed to
   Kubernetes or Cloud Run without code changes. Infrastructure differences are expressed
   entirely in deployment manifests.
   See [ADR-009](adr/ADR-009-infrastructure-kubernetes-cloud-run.md).

5. **Explicit tradeoffs:** Every significant architectural decision is documented with its
   rationale, alternatives considered, and known consequences. Simpler choices are not
   automatically preferred over more capable ones when the capability serves a documented goal.

---

## Technology Choices at a Glance

| Concern              | Choice                                            | Notes                             | ADR                                                                                                         |
| -------------------- | ------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Domain logic         | TypeScript (existing `core/`)                     | Unchanged from GAS version        | —                                                                                                           |
| Monorepo tooling     | Turborepo                                         | Build orchestration               | [ADR-001](adr/ADR-001-monorepo-structure.md)                                                                |
| Architecture pattern | Hexagonal (Ports & Adapters)                      | Core isolated from infrastructure | [ADR-002](adr/ADR-002-ports-and-adapters.md)                                                                |
| Per-user config      | Repository factory                                | Adapter resolved per request      | [ADR-003](adr/ADR-003-per-user-data-store-config.md)                                                        |
| Data store (v1)      | Google Sheets                                     | Per-user spreadsheet ID           | [ADR-004](adr/ADR-004-multi-data-store-adapters.md)                                                         |
| Data store (v2)      | PostgreSQL                                        | Shared schema, `user_id` scoping  | [ADR-004](adr/ADR-004-multi-data-store-adapters.md), [ADR-010](adr/ADR-010-multi-tenancy-data-isolation.md) |
| Auth                 | Clerk (or Auth0) behind `IAuthProvider` interface | Swappable via adapter             | [ADR-005](adr/ADR-005-authentication-strategy.md)                                                           |
| REST + GraphQL       | Dual transport                                    | Same service layer, two protocols | [ADR-006](adr/ADR-006-rest-and-graphql-dual-transport.md)                                                   |
| Web frontend         | Next.js App Router                                | React Server Components           | [ADR-007](adr/ADR-007-nextjs-app-router-web-frontend.md)                                                    |
| Mobile (v1)          | React Native (Expo)                               | Shared logic with web             | [ADR-008](adr/ADR-008-mobile-strategy.md)                                                                   |
| Mobile (v2)          | Native Kotlin (Jetpack Compose)                   | A/B tested against RN             | [ADR-008](adr/ADR-008-mobile-strategy.md)                                                                   |
| Analytics            | Firebase Analytics                                | Shared event taxonomy             | [ADR-012](adr/ADR-012-analytics-and-ab-testing.md)                                                          |
| A/B testing          | Optimizely                                        | Both RN and Kotlin SDKs           | [ADR-012](adr/ADR-012-analytics-and-ab-testing.md)                                                          |
| API server           | NestJS (primary) + Express (legacy comparison)    | Same core, different wiring       | [ADR-011](adr/ADR-011-api-server-nestjs-and-express.md)                                                     |
| Primary infra        | GKE Autopilot + Helm                              | Kubernetes-native                 | [ADR-009](adr/ADR-009-infrastructure-kubernetes-cloud-run.md)                                               |
| Comparison infra     | Google Cloud Run                                  | Same container image              | [ADR-009](adr/ADR-009-infrastructure-kubernetes-cloud-run.md)                                               |
| IaC                  | Terraform                                         | Shared across both targets        | [ADR-009](adr/ADR-009-infrastructure-kubernetes-cloud-run.md)                                               |

---

## Architecture Decision Records

| #                                                             | Title                                                         | Status   |
| ------------------------------------------------------------- | ------------------------------------------------------------- | -------- |
| [ADR-001](adr/ADR-001-monorepo-structure.md)                  | Monorepo Structure with Turborepo                             | Accepted |
| [ADR-002](adr/ADR-002-ports-and-adapters.md)                  | Hexagonal Architecture (Ports and Adapters)                   | Accepted |
| [ADR-003](adr/ADR-003-per-user-data-store-config.md)          | Per-User Data Store Configuration                             | Accepted |
| [ADR-004](adr/ADR-004-multi-data-store-adapters.md)           | Multi-Data-Store Adapter Strategy                             | Accepted |
| [ADR-005](adr/ADR-005-authentication-strategy.md)             | Authentication Strategy                                       | Accepted |
| [ADR-006](adr/ADR-006-rest-and-graphql-dual-transport.md)     | Dual Transport Layer — REST and GraphQL                       | Accepted |
| [ADR-007](adr/ADR-007-nextjs-app-router-web-frontend.md)      | Next.js App Router for Web Frontend                           | Accepted |
| [ADR-008](adr/ADR-008-mobile-strategy.md)                     | Mobile Client Strategy — React Native to Native Kotlin        | Accepted |
| [ADR-009](adr/ADR-009-infrastructure-kubernetes-cloud-run.md) | Infrastructure — GKE Autopilot Primary, Cloud Run Comparison  | Accepted |
| [ADR-010](adr/ADR-010-multi-tenancy-data-isolation.md)        | Multi-Tenancy Data Isolation Strategy                         | Accepted |
| [ADR-011](adr/ADR-011-api-server-nestjs-and-express.md)       | API Server — NestJS Primary with Express Legacy Comparison    | Accepted |
| [ADR-012](adr/ADR-012-analytics-and-ab-testing.md)            | Analytics and A/B Testing — Firebase Analytics and Optimizely | Accepted |

---

## Compliance Awareness

This application currently handles personal fitness data for a single user or small group of
known users. It is not subject to HIPAA or GDPR in its current form. However, architectural
decisions explicitly account for what would need to change if compliance requirements were
introduced. See [ADR-010](adr/ADR-010-multi-tenancy-data-isolation.md) for a detailed treatment
of the compliance implications of each data isolation strategy.
