# ADR Reference Index

Consolidated list of all external sources cited across the Architecture Decision Records.
Each entry links back to the ADR where it is discussed and provides a brief description of why the source is relevant.

---

## Architectural Patterns

| Source | Cited In | Relevance |
|---|---|---|
| [Alistair Cockburn — Hexagonal Architecture (2005)](https://alistair.cockburn.us/hexagonal-architecture/) | [ADR-002](adr/ADR-002-ports-and-adapters.md) | Origin of the Ports and Adapters pattern; the port/adapter vocabulary and dependency rule used throughout the codebase come from here. |
| [Robert C. Martin — The Clean Architecture (2012)](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html) | [ADR-002](adr/ADR-002-ports-and-adapters.md) | Generalises the dependency inversion principle into the "dependency rule": source-code dependencies must point inward toward higher-level policy. |
| [Martin Fowler — Inversion of Control Containers and the Dependency Injection Pattern](https://martinfowler.com/articles/injection.html) | [ADR-002](adr/ADR-002-ports-and-adapters.md), [ADR-011](adr/ADR-011-api-server-nestjs-and-express.md) | Background on constructor injection and IoC containers; directly relevant to how NestJS wires adapters to ports. |

---

## Monorepo Tooling

| Source | Cited In | Relevance |
|---|---|---|
| [Turborepo — Getting Started](https://turbo.build/repo/docs) | [ADR-001](adr/ADR-001-monorepo-structure.md) | Official Turborepo docs; covers caching model, pipeline configuration, and workspace setup. |
| [Turborepo — `turbo prune`](https://turbo.build/repo/docs/reference/prune) | [ADR-001](adr/ADR-001-monorepo-structure.md) | Pruning the monorepo for Docker builds; the approach used to scope `COPY` in each app's Dockerfile. |
| [npm Workspaces](https://docs.npmjs.com/cli/v10/using-npm/workspaces) | [ADR-001](adr/ADR-001-monorepo-structure.md) | The npm workspace protocol enabling `"@logbook/core": "*"` inter-package references. |
| [Nx — Getting Started](https://nx.dev/getting-started/intro) | [ADR-001](adr/ADR-001-monorepo-structure.md) | Primary alternative to Turborepo; ruled out as over-configured for this scale. |

---

## API Server

| Source | Cited In | Relevance |
|---|---|---|
| [NestJS — Documentation](https://docs.nestjs.com) | [ADR-006](adr/ADR-006-rest-and-graphql-dual-transport.md), [ADR-011](adr/ADR-011-api-server-nestjs-and-express.md) | Official NestJS docs; covers modules, providers, controllers, guards, interceptors, and exception filters. |
| [NestJS — Dependency Injection](https://docs.nestjs.com/fundamentals/dependency-injection) | [ADR-011](adr/ADR-011-api-server-nestjs-and-express.md) | The DI container mechanics (`@Injectable`, `@Inject`) that replace Express's manual wiring. |
| [NestJS — Performance (Fastify adapter)](https://docs.nestjs.com/techniques/performance) | [ADR-011](adr/ADR-011-api-server-nestjs-and-express.md) | Documents the `FastifyAdapter`; explains the platform-agnostic adapter API and how to swap from the default Express adapter. |
| [NestJS — GraphQL (Code First)](https://docs.nestjs.com/graphql/quick-start) | [ADR-006](adr/ADR-006-rest-and-graphql-dual-transport.md), [ADR-011](adr/ADR-011-api-server-nestjs-and-express.md) | Code-first approach using TypeScript decorators to generate the GraphQL SDL alongside REST controllers in the same module. |
| [Fastify — Documentation](https://fastify.dev/docs/latest/) | [ADR-011](adr/ADR-011-api-server-nestjs-and-express.md) | The underlying HTTP framework; covers request/response lifecycle, plugins, and schema-based validation. |
| [Fastify — Benchmarks](https://fastify.dev/benchmarks/) | [ADR-011](adr/ADR-011-api-server-nestjs-and-express.md) | Benchmark data supporting the ~2× throughput advantage over Express cited in the Rationale. |
| [Express.js — Routing](https://expressjs.com/en/guide/routing.html) | [ADR-011](adr/ADR-011-api-server-nestjs-and-express.md) | The manual routing approach (`app.get()`) used in the legacy `apps/api-legacy` implementation. |

---

## Transport Layer (REST + GraphQL)

| Source | Cited In | Relevance |
|---|---|---|
| [GraphQL Specification (October 2021)](https://spec.graphql.org/October2021/) | [ADR-006](adr/ADR-006-rest-and-graphql-dual-transport.md) | Normative language and type system specification for GraphQL. |
| [graphql/dataloader — README](https://github.com/graphql/dataloader#readme) | [ADR-006](adr/ADR-006-rest-and-graphql-dual-transport.md), [ADR-015](adr/ADR-015-graphql-dataloader-design.md) | The batching and caching utility for solving the N+1 problem in nested GraphQL resolvers; ADR-015 documents the required per-request instantiation pattern. |
| [Apollo Client — Documentation](https://www.apollographql.com/docs/react/) | [ADR-006](adr/ADR-006-rest-and-graphql-dual-transport.md) | GraphQL client library referenced in the REST vs. GraphQL caching comparison. |
| [NestJS — Injection Scopes](https://docs.nestjs.com/fundamentals/injection-scopes) | [ADR-015](adr/ADR-015-graphql-dataloader-design.md) | Documents `Scope.REQUEST`, scope propagation up the dependency tree, and the performance implications of request-scoped providers; the mechanism used to enforce per-request DataLoader lifecycle. |

---

## Authentication

| Source | Cited In | Relevance |
|---|---|---|
| [RFC 6749 — OAuth 2.0 Authorization Framework](https://datatracker.ietf.org/doc/html/rfc6749) | [ADR-005](adr/ADR-005-authentication-strategy.md) | Core OAuth 2.0 specification; defines the authorisation code flow used by Clerk and Auth0. |
| [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html) | [ADR-005](adr/ADR-005-authentication-strategy.md) | OIDC identity layer on top of OAuth 2.0; defines the ID token, `sub` claim, and UserInfo endpoint. |
| [RFC 7636 — PKCE](https://datatracker.ietf.org/doc/html/rfc7636) | [ADR-005](adr/ADR-005-authentication-strategy.md) | Proof Key for Code Exchange; prevents authorisation code interception in mobile and SPA flows. |
| [OASIS SAML 2.0 Core Specification](https://docs.oasis-open.org/security/saml/v2.0/saml-core-2.0-os.pdf) | [ADR-005](adr/ADR-005-authentication-strategy.md) | Enterprise SSO standard referenced in Future Considerations for B2B extension scenarios. |
| [Clerk — Documentation](https://clerk.com/docs) | [ADR-005](adr/ADR-005-authentication-strategy.md) | Official Clerk docs; covers Next.js SDK, JWT verification, and organisation/session management. |
| [Clerk — Next.js SDK](https://clerk.com/docs/references/nextjs/overview) | [ADR-007](adr/ADR-007-nextjs-app-router-web-frontend.md) | The `@clerk/nextjs` middleware-based auth integration for the App Router. |
| [Auth0 — Documentation](https://auth0.com/docs) | [ADR-005](adr/ADR-005-authentication-strategy.md) | Official Auth0 docs; the primary alternative to Clerk. |

---

## Web Frontend

| Source | Cited In | Relevance |
|---|---|---|
| [Next.js — App Router Documentation](https://nextjs.org/docs/app) | [ADR-007](adr/ADR-007-nextjs-app-router-web-frontend.md) | Official App Router docs; covers Server Components, Client Components, routing, layouts, and Suspense streaming. |
| [React — Server Components](https://react.dev/reference/rsc/server-components) | [ADR-007](adr/ADR-007-nextjs-app-router-web-frontend.md) | React core team reference for RSC; the model the App Router is built on. |
| [Next.js — Loading UI and Streaming](https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming) | [ADR-007](adr/ADR-007-nextjs-app-router-web-frontend.md) | How Suspense boundaries and `loading.tsx` enable progressive rendering of data-heavy pages. |
| [Next.js — fetch API reference](https://nextjs.org/docs/app/api-reference/functions/fetch) | [ADR-007](adr/ADR-007-nextjs-app-router-web-frontend.md) | Documents the `cache` and `next.revalidate` options for `fetch()` in Server Components; authoritative reference for the explicit cache semantics required by the project coding standard. |
| [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/) | [ADR-007](adr/ADR-007-nextjs-app-router-web-frontend.md) | The testing approach for Client Components cited in the Consequences section. |

---

## Data Layer

| Source | Cited In | Relevance |
|---|---|---|
| [Google Sheets API v4 — Reference](https://developers.google.com/sheets/api/reference/rest) | [ADR-004](adr/ADR-004-multi-data-store-adapters.md) | The API used by the Sheets adapter; documents range notation, batch operations, and value rendering modes. |
| [Google Sheets API — Usage Limits](https://developers.google.com/sheets/api/limits) | [ADR-004](adr/ADR-004-multi-data-store-adapters.md) | The 100 requests/100 seconds per-user quota cited in the Consequences section. |
| [googleapis npm package](https://www.npmjs.com/package/googleapis) | [ADR-004](adr/ADR-004-multi-data-store-adapters.md) | The Node.js client library wrapping the Sheets API. |
| [Prisma ORM — Getting Started](https://www.prisma.io/docs/getting-started) | [ADR-004](adr/ADR-004-multi-data-store-adapters.md) | The ORM for the Postgres adapter; provides schema definition, type-safe query building, and migrations. |
| [Prisma Migrate](https://www.prisma.io/docs/orm/prisma-migrate/getting-started) | [ADR-004](adr/ADR-004-multi-data-store-adapters.md) | The migration system for evolving the Postgres schema. |
| [Prisma Client — Middleware](https://www.prisma.io/docs/orm/prisma-client/client-extensions/middleware) | [ADR-003](adr/ADR-003-per-user-data-store-config.md) | How Prisma middleware injects `app.current_user_id` before each query to enforce per-user scoping. |
| [PostgreSQL — JSON Types (JSONB)](https://www.postgresql.org/docs/current/datatype-json.html) | [ADR-003](adr/ADR-003-per-user-data-store-config.md) | The `JSONB` column type used for `adapter_config`; covers indexing, operators, and storage behaviour. |
| [PostgreSQL — Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html) | [ADR-010](adr/ADR-010-multi-tenancy-data-isolation.md) | The RLS feature used for database-level isolation; `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and `CREATE POLICY` syntax. |
| [PostgreSQL — Schemas](https://www.postgresql.org/docs/current/ddl-schemas.html) | [ADR-010](adr/ADR-010-multi-tenancy-data-isolation.md) | The schema-per-tenant alternative to shared-schema; covers `CREATE SCHEMA` and `search_path`. |
| [PgBouncer — Usage](https://www.pgbouncer.org/usage.html) | [ADR-010](adr/ADR-010-multi-tenancy-data-isolation.md) | Connection pooler cited in the schema-per-tenant alternative discussion (`search_path` management). |

---

## Infrastructure

| Source | Cited In | Relevance |
|---|---|---|
| [GKE Autopilot — Overview](https://cloud.google.com/kubernetes-engine/docs/concepts/autopilot-overview) | [ADR-009](adr/ADR-009-infrastructure-kubernetes-cloud-run.md) | Documents the Autopilot node management model, pod-based billing, and resource constraints. |
| [Google Cloud Run — Overview](https://cloud.google.com/run/docs/overview/what-is-cloud-run) | [ADR-009](adr/ADR-009-infrastructure-kubernetes-cloud-run.md) | Documents scale-to-zero behaviour, cold start characteristics, and request-based billing. |
| [Terraform — Documentation](https://developer.hashicorp.com/terraform/docs) | [ADR-009](adr/ADR-009-infrastructure-kubernetes-cloud-run.md) | IaC tool used to provision GKE, Cloud Run, VPC, and load balancer resources. |
| [Helm — Documentation](https://helm.sh/docs/) | [ADR-009](adr/ADR-009-infrastructure-kubernetes-cloud-run.md) | Kubernetes package manager for `charts/api` and `charts/web`; covers chart structure, values files, and `helm upgrade`. |
| [Kubernetes — Horizontal Pod Autoscaler](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/) | [ADR-009](adr/ADR-009-infrastructure-kubernetes-cloud-run.md) | The HPA configuration shown in the Decision section (`minReplicas: 2`, `maxReplicas: 10`, CPU target 70%). |
| [Google Cloud Load Balancing — HTTPS](https://cloud.google.com/load-balancing/docs/https) | [ADR-009](adr/ADR-009-infrastructure-kubernetes-cloud-run.md) | The load balancer used for 90/10 traffic splitting between GKE and Cloud Run. |
| [Google Artifact Registry — Overview](https://cloud.google.com/artifact-registry/docs/overview) | [ADR-009](adr/ADR-009-infrastructure-kubernetes-cloud-run.md) | Container registry where Docker images are pushed by CI/CD. |
| [k6 — Load Testing Documentation](https://grafana.com/docs/k6/latest/) | [ADR-009](adr/ADR-009-infrastructure-kubernetes-cloud-run.md) | Load testing tool used for the scale-out time metric in the A/B infrastructure comparison. |
| [Google Cloud KMS — Envelope Encryption](https://cloud.google.com/kms/docs/envelope-encryption) | [ADR-003](adr/ADR-003-per-user-data-store-config.md) | Encryption strategy for the `adapter_config` column, which stores sensitive Sheets credentials. |

---

## Mobile

| Source | Cited In | Relevance |
|---|---|---|
| [React Native — Getting Started](https://reactnative.dev/docs/getting-started) | [ADR-008](adr/ADR-008-mobile-strategy.md) | Official React Native documentation. |
| [Expo — Documentation](https://docs.expo.dev) | [ADR-008](adr/ADR-008-mobile-strategy.md) | Expo managed workflow used in Phase 1; covers project structure, native modules, and OTA updates. |
| [Expo EAS Build](https://docs.expo.dev/build/introduction/) | [ADR-008](adr/ADR-008-mobile-strategy.md) | Cloud build service producing Android APKs without a local native toolchain. |
| [React Navigation — Getting Started](https://reactnavigation.org/docs/getting-started) | [ADR-008](adr/ADR-008-mobile-strategy.md) | Navigation library used in the React Native client. |
| [Jetpack Compose — Documentation](https://developer.android.com/develop/ui/compose/documentation) | [ADR-008](adr/ADR-008-mobile-strategy.md) | Native Android UI framework used in the Kotlin (Phase 2) client. |
| [Kotlin — Documentation](https://kotlinlang.org/docs/home.html) | [ADR-008](adr/ADR-008-mobile-strategy.md) | Official Kotlin language reference. |
| [Google Play — Manage Tracks](https://support.google.com/googleplay/android-developer/answer/9844487) | [ADR-008](adr/ADR-008-mobile-strategy.md) | How internal, closed testing, and production tracks work; the mechanism for deploying Phase 1 and Phase 2 builds simultaneously. |

---

## Analytics and A/B Testing

| Source | Cited In | Relevance |
|---|---|---|
| [Firebase Analytics — Overview](https://firebase.google.com/docs/analytics) | [ADR-012](adr/ADR-012-analytics-and-ab-testing.md) | Official Firebase Analytics docs; covers event logging, user properties, and audience segmentation. |
| [React Native Firebase — Analytics](https://rnfirebase.io/analytics/usage) | [ADR-012](adr/ADR-012-analytics-and-ab-testing.md) | The `@react-native-firebase/analytics` SDK used in the React Native client. |
| [Firebase Analytics for Android](https://firebase.google.com/docs/analytics/get-started?platform=android) | [ADR-012](adr/ADR-012-analytics-and-ab-testing.md) | The `com.google.firebase:firebase-analytics` SDK used in the Kotlin client. |
| [Firebase Crashlytics](https://firebase.google.com/docs/crashlytics) | [ADR-012](adr/ADR-012-analytics-and-ab-testing.md) | Crash reporting SDK used in both clients; crash-free session rate is a primary A/B comparison metric. |
| [Firebase Performance Monitoring](https://firebase.google.com/docs/perf-mon) | [ADR-012](adr/ADR-012-analytics-and-ab-testing.md) | Screen render time and app startup time SDK cited in the A/B metrics table. |
| [Firebase — BigQuery Export](https://firebase.google.com/docs/projects/bigquery-export) | [ADR-012](adr/ADR-012-analytics-and-ab-testing.md) | How Firebase Analytics data is streamed to BigQuery for deeper analysis. |
| [Optimizely Feature Experimentation — Welcome](https://docs.developers.optimizely.com/feature-experimentation/docs/welcome) | [ADR-012](adr/ADR-012-analytics-and-ab-testing.md) | Official Optimizely docs; covers experiment configuration, variation assignment, and event tracking. |
| [Optimizely — JavaScript (React) SDK](https://docs.developers.optimizely.com/feature-experimentation/docs/javascript-react-sdk) | [ADR-012](adr/ADR-012-analytics-and-ab-testing.md) | The `@optimizely/react-sdk` used in the React Native client. |
| [Optimizely — Android SDK](https://docs.developers.optimizely.com/feature-experimentation/docs/android-sdk) | [ADR-012](adr/ADR-012-analytics-and-ab-testing.md) | The `com.optimizely.sdk:android-sdk` used in the Kotlin client. |

---

## Compliance

| Source | Cited In | Relevance |
|---|---|---|
| [GDPR — Article 17: Right to Erasure](https://gdpr-info.eu/art-17-gdpr/) | [ADR-010](adr/ADR-010-multi-tenancy-data-isolation.md) | The regulatory requirement driving the erasure complexity comparison between shared-schema and schema-per-tenant strategies. |
| [HHS — HIPAA Security Rule](https://www.hhs.gov/hipaa/for-professionals/security/index.html) | [ADR-010](adr/ADR-010-multi-tenancy-data-isolation.md) | US healthcare data protection regulation discussed in the HIPAA section; relevant if the application is extended to clinical contexts. |

---

## Security Review

References from [`docs/security-review-checklist.md`](security-review-checklist.md).

| Source | Cited In | Relevance |
|---|---|---|
| [OWASP Top 10 (2021)](https://owasp.org/Top10/) | [Security Review Checklist](security-review-checklist.md) | The ten most critical web application security risks; used as the framework for the OWASP applicability section. |
| [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) | [Security Review Checklist](security-review-checklist.md) | Practical guidance for implementing and reviewing authentication mechanisms; informs the token handling and session checklist items. |
| [OWASP SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html) | [Security Review Checklist](security-review-checklist.md) | Parameterised query requirements referenced in the A03 (Injection) OWASP applicability row. |
| [NestJS — Security](https://docs.nestjs.com/security/helmet) | [Security Review Checklist](security-review-checklist.md) | Official NestJS docs covering Helmet, CORS, rate limiting, and CSRF protection; informs Section 6 (Security Headers and Transport). |
| [Clerk — Security](https://clerk.com/docs/security/overview) | [Security Review Checklist](security-review-checklist.md) | Clerk's security model; documents token verification, session management, and compliance posture. |

---

## Case Studies

Empirical evidence from practitioners. Full case studies are in [`docs/case-studies.md`](case-studies.md).

| Source | Cited In | Relevance |
|---|---|---|
| [Trilon.io Blog](https://trilon.io/blog) | [ADR-011](adr/ADR-011-api-server-nestjs-and-express.md) | Posts from NestJS core contributors on module design, DI patterns, circular dependency resolution, and production deployment; primary source for NestJS startup overhead characterisation. |
| [Next.js 15 Upgrade Guide](https://nextjs.org/docs/app/building-your-application/upgrading/version-15) | [ADR-007](adr/ADR-007-nextjs-app-router-web-frontend.md) | Documents the reversal of the default `fetch` caching behaviour between Next.js 14 and 15; the primary production pain point identified in the App Router case study. |
| [Vercel Engineering Blog](https://vercel.com/blog/engineering) | [ADR-007](adr/ADR-007-nextjs-app-router-web-frontend.md) | Posts by the Next.js team on App Router adoption patterns and production operational experience. |
| [Introducing GKE Autopilot (GA announcement, February 2021)](https://cloud.google.com/blog/products/containers-kubernetes/introducing-gke-autopilot) | [ADR-009](adr/ADR-009-infrastructure-kubernetes-cloud-run.md) | Google's GA announcement documenting the Autopilot design rationale; supplements the overview docs with the motivation for the fully-managed node model. |
| [Cloud Run — Concurrency](https://cloud.google.com/run/docs/about-concurrency) | [ADR-009](adr/ADR-009-infrastructure-kubernetes-cloud-run.md) | Covers the concurrency model, CPU allocation, and minimum instances; directly relevant to cold start mitigation and cost profile. |
| [Cloud Run — Pricing](https://cloud.google.com/run/pricing) | [ADR-009](adr/ADR-009-infrastructure-kubernetes-cloud-run.md) | Authoritative source for the per-request cost model used in the ADR-009 A/B comparison table. |
| [ThoughtWorks Technology Radar — Hexagonal Architecture](https://www.thoughtworks.com/radar/techniques/hexagonal-architecture) | [ADR-002](adr/ADR-002-ports-and-adapters.md) | ThoughtWorks's ongoing assessment of the pattern; documents adapter proliferation and enforcement failure modes at team scale. |
| [Martin Fowler — BoundedContext](https://martinfowler.com/bliki/BoundedContext.html) | [ADR-002](adr/ADR-002-ports-and-adapters.md) | Relevant context on where adapter boundaries should align with domain boundaries. |
| [GitHub — The GitHub GraphQL API (September 2016)](https://github.blog/2016-09-14-the-github-graphql-api/) | [ADR-006](adr/ADR-006-rest-and-graphql-dual-transport.md) | The canonical production example of dual REST + GraphQL transport; documents the overfetching driver, client migration pattern, and permanent-commitment risk. |
| [Shopify Engineering Blog](https://shopify.engineering/) | [ADR-006](adr/ADR-006-rest-and-graphql-dual-transport.md) | Documents Shopify's GraphQL-first API strategy maintained alongside REST; covers N+1 batching and query complexity scoring. |
