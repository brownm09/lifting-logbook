# Architecture Case Studies

Empirical evidence from practitioners who have run these technologies in production.
Each section links to the relevant ADR and cites primary sources wherever available.

---

## Table of Contents

1. [NestJS at Scale](#nestjs-at-scale)
2. [Next.js App Router in Production](#nextjs-app-router-in-production)
3. [GKE Autopilot: Operational Experience](#gke-autopilot-operational-experience)
4. [Google Cloud Run: Cost and Cold Starts](#google-cloud-run-cost-and-cold-starts)
5. [Hexagonal Architecture at Team Scale](#hexagonal-architecture-at-team-scale)
6. [Dual REST + GraphQL Transport](#dual-rest--graphql-transport)

---

## NestJS at Scale

**Relevant ADR:** [ADR-011 — API Server: NestJS and Express](adr/ADR-011-api-server-nestjs-and-express.md)

### Adidas — Platform API Gateway

Adidas publicly attributed NestJS as the framework powering their API gateway, which handles traffic for one of the largest sportswear e-commerce platforms in Europe. Their engineering team highlighted NestJS's module system as the primary reason for adoption: the ability to enforce consistent request-handling contracts (guards, interceptors, pipes) across dozens of microservices without repeating configuration.

**Pain points reported by the NestJS community and Trilon.io (the NestJS core consulting firm):**

- **Circular dependency exceptions** are the most common production issue at large module graphs. NestJS provides `forwardRef()` as an escape hatch, but relying on it is a code smell — it usually signals that the module boundary design is wrong. Teams that hit this at scale typically restructure shared concerns into a `SharedModule`.
- **DI container startup overhead** grows with module count. A NestJS application with 40–60 modules (realistic for a mid-size monolith) can take 2–5 seconds to initialize its DI graph during cold start. For a container on GKE that restarts frequently, this is relevant to liveness probe configuration.
- **`TestingModule` in unit tests** reconstructs the full DI graph per test file, making test suites slow when modules are large. Teams mitigate this by using `createTestingModule` with minimal providers and relying on interface mocks.

**Lesson for this project:** NestJS's benefits (enforced DI, code-first GraphQL, platform-agnostic adapters) are real and validated at scale. The startup overhead is the only meaningful risk for this architecture — mitigated by GKE's `terminationGracePeriodSeconds` and readiness probe configuration.

**Primary sources:**
- [Trilon.io Blog](https://trilon.io/blog) — posts from NestJS core contributors on module design, DI patterns, and production deployment
- [NestJS — Official Documentation](https://docs.nestjs.com) — the module, DI, and performance sections document the constraints directly

---

## Next.js App Router in Production

**Relevant ADR:** [ADR-007 — Next.js App Router Web Frontend](adr/ADR-007-nextjs-app-router-web-frontend.md)

### Vercel — vercel.com

Vercel migrated their own production site (`vercel.com`) to the App Router and published learnings during the Next.js 13 and 14 release cycles. As the creator and primary deployer of Next.js, Vercel's own production experience carries particular weight.

**Key pain points documented in Vercel's engineering blog and Next.js release notes:**

- **Aggressive default caching (Next.js 14) caused production surprises.** In Next.js 14, `fetch()` calls inside Server Components were cached by default with no expiry. Teams expecting fresh data on every request shipped stale UIs to production. This was a sufficiently widespread complaint that Next.js 15 reversed the default: `fetch()` is now uncached by default. The reversal is documented in the [Next.js 15 upgrade guide](https://nextjs.org/docs/app/building-your-application/upgrading/version-15).
- **`useSearchParams()` requires a Suspense boundary** or Next.js throws an error at build time. This boundary requirement is not obvious to developers migrating from Pages Router, where query parameters were synchronous. It has been a consistent source of first-time App Router breakage.
- **React Server Component / Client Component boundary confusion.** A component tree can accidentally import a `"use client"` component deep in a server-rendered tree, forcing the entire subtree to hydrate on the client. The error message points at the leaf component, not the boundary where the problem was introduced, making debugging non-trivial.

**Lesson for this project:** The App Router's Server Components and Suspense streaming are validated in production by Vercel and large adopters. The primary risk is the caching model — the `cache` option must be set explicitly on every `fetch()` call rather than relying on defaults, which changed between Next.js 14 and 15. This should be treated as a first-class concern during implementation.

**Discrepancy with ADR-007:** ADR-007 cites streaming and Suspense as a benefit without noting that the default caching model changed between major releases. Teams should pin a Next.js minor version and treat upgrades as deliberate migration events rather than routine dependency bumps.

**Primary sources:**
- [Next.js 15 Upgrade Guide — Caching changes](https://nextjs.org/docs/app/building-your-application/upgrading/version-15) — documents the `fetch` cache default reversal
- [Next.js — App Router Documentation](https://nextjs.org/docs/app) — the authoritative reference for Server Components, loading UI, and caching semantics
- [Vercel Engineering Blog](https://vercel.com/blog/engineering) — posts by the Next.js team on App Router adoption patterns

---

## GKE Autopilot: Operational Experience

**Relevant ADR:** [ADR-009 — Infrastructure: Kubernetes and Cloud Run](adr/ADR-009-infrastructure-kubernetes-cloud-run.md)

### Google Cloud — Official GKE Autopilot Documentation and GA Announcement

GKE Autopilot reached general availability in February 2021. Google's official documentation and the GA blog post are the authoritative primary source for its operational model, as the external third-party case study ecosystem for Autopilot specifically (vs. standard GKE) remains thin compared to the broader Kubernetes ecosystem.

**Operational model differences from standard GKE:**

| Dimension | Standard GKE | Autopilot |
|---|---|---|
| Node provisioning | You manage node pools | Google manages all nodes |
| Billing unit | Per node (VM hours) | Per pod (CPU + memory requests) |
| DaemonSets | Supported | **Not allowed** (platform DaemonSets only) |
| Privileged containers | Configurable | **Blocked** (security policy enforced) |
| GPU workloads | Full support | Supported since 2022; limited SKU selection |
| Node affinity/taints | Full control | Workload profiles only (`balanced`, `scale-out`, `spot`) |

**Cost profile at low traffic (validated by community reports on Google Cloud forums and GKE Autopilot GitHub issues):**

- Autopilot is typically **more expensive** than a well-tuned standard GKE cluster where developers have set accurate resource requests and managed node pools efficiently. The premium is roughly 10–20% on compute cost in exchange for eliminating the node management operational burden.
- At startup scale (2–4 pods), the difference is small in absolute dollars — the relevant comparison is engineer-hours saved on node pool upgrades, security patching, and sizing decisions.

**Limitations affecting this architecture:**

- **No DaemonSets** means tooling that typically runs as a DaemonSet (log forwarders, metrics agents) must use a sidecar or Workload Identity-based configuration instead. This is a well-understood pattern but requires intentional design.
- **Startup latency for new nodes** — when a burst of pods is scheduled and Autopilot must provision new nodes, the first pod can wait 60–90 seconds. This affects HPA scale-out time and must be accounted for in `k6` load tests.

**Lesson for this project:** Autopilot is well-matched for this project's profile: a greenfield app without existing node pool conventions, with a small ops team that cannot dedicate time to cluster maintenance. The DaemonSet restriction is the only non-obvious operational constraint. ADR-009's cost estimate acknowledges the pod-based billing model correctly.

**Primary sources:**
- [GKE Autopilot — Overview](https://cloud.google.com/kubernetes-engine/docs/concepts/autopilot-overview) — official documentation covering billing, limitations, and workload profiles
- [Introducing GKE Autopilot (GA blog post, February 2021)](https://cloud.google.com/blog/products/containers-kubernetes/introducing-gke-autopilot) — Google's GA announcement documenting the design rationale

---

## Google Cloud Run: Cost and Cold Starts

**Relevant ADR:** [ADR-009 — Infrastructure: Kubernetes and Cloud Run](adr/ADR-009-infrastructure-kubernetes-cloud-run.md)

### Google Cloud — Official Cloud Run Documentation

Cloud Run's cold start characteristics are thoroughly documented in Google's official documentation and have been measured by the community across runtimes.

**Cold start latency by runtime (from Google Cloud documentation and community benchmarks):**

| Runtime | Typical cold start | Notes |
|---|---|---|
| Node.js | 200–600 ms | Depends heavily on `node_modules` size |
| Go | 100–300 ms | Very fast; compiled binary with minimal startup |
| Java (Spring Boot) | 3–10 s | JVM startup overhead; significant without GraalVM native image |
| Python | 400–1000 ms | Import time dominates |

For this project (Node.js/NestJS backend), a well-optimized Docker image (multi-stage build, `npm ci --only=production`) should target the 200–400ms range. Unoptimized images with `devDependencies` included can reach 1–2 seconds.

**Cost model (from Cloud Run pricing documentation):**

- **Scale-to-zero** eliminates compute cost when there is no traffic. For a hobby/early-stage app with spiky traffic, this is the primary cost advantage over GKE.
- **Concurrency default** is 80 requests per instance. This means a single instance can absorb a small burst without cold starts. Misconfiguring concurrency to `1` (the correct value for CPU-intensive workloads) dramatically increases instance count and can erase the cost advantage.
- **Minimum instances** — setting `--min-instances 1` eliminates cold starts at the cost of always-on compute (~$7–10/month per instance at default Cloud Run pricing).

**Comparison data (ADR-009 A/B table validation):**

The ADR-009 comparison table shows Cloud Run as cheaper at low traffic and GKE as cheaper at sustained high traffic. This is consistent with Google's public pricing documentation and community reporting. The crossover point is typically around 50–100 sustained requests per second where GKE's node-level pricing becomes more efficient than Cloud Run's per-request billing.

**Lesson for this project:** Cloud Run is the correct choice for the legacy comparison service (`apps/api-legacy`) and for early-stage deployment of the primary API before traffic patterns are known. The cold start window (200–600ms for Node.js) is acceptable for non-latency-critical endpoints. If the app graduates to sustained traffic, migrating to GKE involves a Helm chart change rather than a rewrite — the ADR's dual-track deployment model is the right hedge.

**Primary sources:**
- [Cloud Run — Container instance lifecycle](https://cloud.google.com/run/docs/container-contract) — documents the instance startup sequence and how to minimize cold start latency
- [Cloud Run — Concurrency](https://cloud.google.com/run/docs/about-concurrency) — covers the concurrency model, CPU allocation, and minimum instances
- [Cloud Run — Pricing](https://cloud.google.com/run/pricing) — authoritative source for the cost model used in ADR-009's comparison table

---

## Hexagonal Architecture at Team Scale

**Relevant ADR:** [ADR-002 — Ports and Adapters Architecture](adr/ADR-002-ports-and-adapters.md)

### ThoughtWorks Technology Radar and Industry Experience

ThoughtWorks has consistently recommended Hexagonal Architecture on their Technology Radar since its appearance there in 2016. Their consulting work across large enterprise codebases provides a broad empirical base for the pattern's strengths and failure modes at team scale.

**Where the pattern helps (well-documented across the industry):**

- **Test isolation is measurably better.** Teams that enforce the port/adapter boundary can test all domain logic without spinning up databases, external services, or HTTP stacks. Test suite times drop from minutes (integration tests only) to seconds (unit tests against ports with in-memory adapters).
- **Adapter swapping is real.** Teams have replaced ORMs, message brokers, and auth providers with near-zero domain logic changes — exactly the outcome the pattern promises. The value is highest when the team has already paid down the adapter abstraction cost.

**Where the pattern breaks down (reported by ThoughtWorks and Martin Fowler's colleagues):**

- **Adapter proliferation at large team size.** Every external dependency requires three artifacts: an interface (port), a production implementation (adapter), and a test double (mock/stub). At 20+ external dependencies, the adapter layer itself becomes a maintenance surface. Teams working on the interface proliferation problem sometimes consolidate multiple related ports into an "aggregate port" but this introduces its own coupling risks.
- **Enforcement degrades under deadline pressure.** The most common failure mode is not a technical one: developers under time pressure import infrastructure packages directly into `packages/core` and "fix it later." Without automated enforcement (ESLint rules, build-time import guards) this compounds quickly. The pattern requires cultural commitment and tooling.
- **DI wiring complexity at large scale.** An application with 30+ adapter bindings has substantial bootstrapping code. Without a DI framework (like NestJS's module system), this becomes a hand-written factory that is easy to get wrong. NestJS's module system addresses this — but it means the choice of NestJS and the choice of hexagonal architecture are tightly coupled in this architecture.

**Lesson for this project:** The pattern is well-validated for the use case here: a single-developer or small-team app where test speed and long-term flexibility are prioritized. The adapter proliferation concern is real but only becomes painful beyond ~10 external dependencies. The tighter risk is enforcement — the ESLint `no-restricted-imports` rule should be configured to prevent `packages/core` from importing anything in `apps/` or infrastructure packages.

**Discrepancy with ADR-002:** ADR-002 does not address enforcement tooling. The pattern's benefits are contingent on the boundary being enforced, not just documented.

**Primary sources:**
- [Alistair Cockburn — Hexagonal Architecture (2005)](https://alistair.cockburn.us/hexagonal-architecture/) — the original pattern description (already cited in ADR-002)
- [ThoughtWorks Technology Radar — Hexagonal Architecture](https://www.thoughtworks.com/radar/techniques/hexagonal-architecture) — ThoughtWorks's ongoing assessment of the pattern in enterprise contexts
- [Martin Fowler — BoundedContext](https://martinfowler.com/bliki/BoundedContext.html) — relevant context on where adapter boundaries should align with domain boundaries

---

## Dual REST + GraphQL Transport

**Relevant ADR:** [ADR-006 — REST and GraphQL Dual Transport](adr/ADR-006-rest-and-graphql-dual-transport.md)

### GitHub — REST API v3 and GraphQL API v4

GitHub is the canonical production example of running REST and GraphQL in parallel on the same platform. GitHub launched their GraphQL API v4 in September 2016, alongside the existing REST API v3 which had been in production since 2009.

**Why GitHub added GraphQL alongside REST (from their announcement post):**

> "The REST API v3 is very good, but it has some limitations: we've seen that integrators sometimes have to make lots of requests to the REST API to assemble a complete picture of the data they need."

GitHub's engineering team documented that a common developer workflow (fetching repository metadata, contributors, and recent commits) required 6–8 round trips via REST but could be completed in a single GraphQL query. This overfetching problem is the same driver cited in ADR-006.

**Operational observations from maintaining both (from the GitHub Engineering blog and community reporting):**

- **REST API v3 was not deprecated.** As of 2025, GitHub still actively maintains both APIs. The migration cost of breaking millions of REST integrations outweighed the operational cost of maintaining both. This is relevant: "dual transport" in GitHub's case became a permanent commitment, not a transitional state.
- **Schema synchronization requires discipline.** When GitHub introduced new features (Actions, Projects, Codespaces), they shipped REST endpoints and GraphQL fields simultaneously. This requires a process change: feature work now has two integration surfaces to ship and document.
- **Mobile and tooling clients gravitated to GraphQL.** GitHub's CLI (`gh`) was built against the GraphQL API. The GitHub mobile apps query the GraphQL API. REST remains the primary integration surface for CI tools, webhooks, and third-party integrations that existed before 2016.

**Lesson for this project:** ADR-006's decision to maintain both transports is validated by GitHub's production experience. The key operational risk GitHub demonstrates is that dual transport becomes a permanent commitment once external consumers exist. For this project, that concern is deferred: there are no external consumers yet. The discipline question is whether every future domain change ships updates to both the REST controller and the GraphQL resolver simultaneously — which NestJS's code-first approach mitigates by deriving both from the same TypeScript class.

### Shopify — GraphQL-First API Strategy

Shopify began migrating their developer API to GraphQL in 2018 and adopted a "GraphQL-first" strategy for all new API surface. Their REST Admin API continues to be maintained alongside it for existing merchants.

**Key observations from the Shopify Engineering blog:**

- Shopify's N+1 problem in GraphQL resolvers was severe enough that they extracted `graphql-batch` (a Ruby equivalent of Facebook's DataLoader) and open-sourced it. The N+1 problem in nested resolvers is a known cost of dual transport that requires explicit tooling.
- **REST clients were more predictable for billing.** Shopify found that REST API calls were easier to rate-limit by endpoint, while GraphQL queries had highly variable complexity. They developed query complexity scoring to apply equivalent limits to GraphQL.

**Primary sources:**
- [GitHub — The GitHub GraphQL API (September 2016)](https://github.blog/2016-09-14-the-github-graphql-api/) — GitHub's original announcement explaining the rationale for GraphQL alongside REST
- [Shopify Engineering Blog](https://shopify.engineering/) — posts covering their GraphQL adoption and the N+1 / batching challenges at merchant scale
- [graphql/dataloader](https://github.com/graphql/dataloader) — the batching utility that addresses the N+1 problem documented in both GitHub's and Shopify's experiences (already cited in ADR-006)
