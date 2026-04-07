# ARB Review — ADR-001 through ADR-013

**Date:** 2026-04-07
**Reviewer:** @brownm09
**Checklist:** [arb-review-checklist.md](arb-review-checklist.md)
**Milestone:** v0.1 — Foundation (closes with this review)

---

## Summary

| ADR | Title | Outcome | Open Items |
|---|---|---|---|
| [ADR-001](../adr/ADR-001-monorepo-structure.md) | Monorepo Structure with Turborepo | Pass | — |
| [ADR-002](../adr/ADR-002-ports-and-adapters.md) | Hexagonal Architecture (Ports and Adapters) | Pass | — |
| [ADR-003](../adr/ADR-003-per-user-data-store-config.md) | Per-User Data Store Configuration | Pass with gaps | #38, #39 |
| [ADR-004](../adr/ADR-004-multi-data-store-adapters.md) | Multi-Data-Store Adapter Strategy | Pass | — |
| [ADR-005](../adr/ADR-005-authentication-strategy.md) | Authentication Strategy | Pass | — |
| [ADR-006](../adr/ADR-006-rest-and-graphql-dual-transport.md) | Dual Transport — REST and GraphQL | Pass with gaps | #40 |
| [ADR-007](../adr/ADR-007-nextjs-app-router-web-frontend.md) | Next.js App Router Web Frontend | Pass | — |
| [ADR-008](../adr/ADR-008-mobile-strategy.md) | Mobile Strategy — React Native and Kotlin | Pass with gaps | #41, #42 |
| [ADR-009](../adr/ADR-009-infrastructure-kubernetes-cloud-run.md) | Infrastructure — GKE Autopilot and Cloud Run | Pass | — |
| [ADR-010](../adr/ADR-010-multi-tenancy-data-isolation.md) | Multi-Tenancy Data Isolation | Pass | — |
| [ADR-011](../adr/ADR-011-api-server-nestjs-and-express.md) | API Server — NestJS and Express | Pass with gaps | #42 |
| [ADR-012](../adr/ADR-012-analytics-and-ab-testing.md) | Analytics and A/B Testing | Pass with gaps | #41 |
| [ADR-013](../adr/ADR-013-testing-strategy.md) | Testing Strategy | Pass | — |

**7 Pass / 6 Pass with gaps / 0 Critical gaps.** No milestone-blocking issues. Five follow-up issues filed; all are High or Medium severity, targeting v0.2 or v0.3.

---

## Per-ADR Findings

### ADR-001 — Monorepo Structure with Turborepo

**Outcome:** Pass

All checklist sections satisfied. Problem statement is scoped, two alternatives are rejected with rationale (polyrepo, single flat package), consequences documented. `turbo prune` Docker scoping risk is noted. ESLint and TypeScript enforcement of the workspace boundaries are delegated to ADR-002 and enforced in CI. References are primary sources.

No gaps found.

---

### ADR-002 — Hexagonal Architecture (Ports and Adapters)

**Outcome:** Pass

Strong ADR. The dependency rule is stated unambiguously. ESLint `no-restricted-imports` enforcement is implemented, documented in the ADR, and verified in CI (PR #36). The enforcement failure mode at team scale is explicitly cited with case study evidence and directly mitigated. Reversibility to a layered architecture is not sketched, but the decision is correctly classified as foundational — the entire project structure depends on it, and "reversible" is not a meaningful property here.

No gaps found.

---

### ADR-003 — Per-User Data Store Configuration

**Outcome:** Pass with gaps

**Gap 1 — High: No ADR for credential encryption at rest.**
The ADR states that `adapter_config` (a JSONB column) contains Google Sheets credentials and requires KMS envelope encryption, but the encryption design is not documented anywhere. Which field within `adapter_config` is encrypted? Is the entire column encrypted or just credential fields? What KMS key hierarchy is used? What happens at key rotation? This is a security-critical gap — the decision is noted but the design is deferred without a tracking issue. → **Issue #38**

**Gap 2 — Medium: Cache invalidation for `user_data_source` lookup has no explicit mechanism.**
The ADR documents a ~5-minute TTL cache on the per-request factory lookup. It correctly notes that config changes (e.g., migrating a user from Sheets to Postgres) take effect after the TTL expires. However, there is no documented mechanism for:
- Admin-triggered immediate invalidation (e.g., when a migration is in progress)
- Detection of stale cache serving wrong adapter after migration
This is not a blocking risk at current (personal-use) scale, but needs resolution before multi-user migrations are attempted. → **Issue #39**

---

### ADR-004 — Multi-Data-Store Adapter Strategy

**Outcome:** Pass

Two adapters (Sheets, Postgres) are well-documented with schema excerpts, rationale, and consequences. The Google Sheets API quota limitation (100 req/100s per user) is called out as an accepted risk for personal use. Prisma Migrate is named as the Postgres migration tool; this is consistent with ADR-013's Testcontainers approach (Testcontainers runs Prisma migrations before the test suite). Credential encryption at rest for Sheets credentials is deferred to ADR-003's gap (#38). No additional gaps.

---

### ADR-005 — Authentication Strategy

**Outcome:** Pass

The `IAuthProvider` interface abstraction is well-motivated. The JWT flow (client → Clerk → JWT → API middleware → `AuthUser`) is documented clearly. The `sub` claim as stable user primary key is correctly identified and its implications (Clerk `sub` becomes the `user_id` FK in every data table) are noted. Enterprise SSO (SAML 2.0) and HIPAA BAA are documented as future options on paid plans. Compliance posture is explicit: current scope is personal fitness data, not regulated.

The ADR does not detail the `IAuthProvider` interface contract itself — but interface design is appropriately the domain of the port interfaces implementation issues (#12 in the backlog), not the ADR. No gaps.

---

### ADR-006 — Dual Transport — REST and GraphQL

**Outcome:** Pass with gaps

**Gap 1 — Medium: DataLoader strategy for GraphQL N+1 is identified but not designed.**
The ADR correctly calls out the GraphQL N+1 problem and names `graphql/dataloader` as the solution. However, there is no design for how DataLoaders are wired into NestJS (module scope vs. request scope), what the batching key strategies are, or how DataLoaders interact with the per-request adapter resolution from ADR-003. Getting this wrong is a common and expensive mistake — DataLoaders at the wrong scope cause data leakage between requests. This needs a design document or ADR before GraphQL resolvers are implemented. → **Issue #40**

REST and GraphQL versioning strategies are both documented (URL prefix for REST, deprecation directives for GraphQL). The maintenance burden of two API surfaces is explicitly accepted with case study evidence. No other gaps.

---

### ADR-007 — Next.js App Router Web Frontend

**Outcome:** Pass

The highest-risk item in this ADR — the Next.js 14→15 `fetch()` caching behavior reversal — has been fully resolved. A coding standard was documented in `docs/standards/fetch-cache-semantics.md` (PR #37) requiring all `fetch()` calls to specify cache semantics explicitly. The standard is referenced from the ADR. No reliance on version defaults remains.

Server/client component boundary considerations, auth middleware approach, and testing strategy (Jest + RTL) are all documented. References include both the Next.js 15 Upgrade Guide and a case study on the caching pitfall.

No gaps found.

---

### ADR-008 — Mobile Strategy — React Native to Native Kotlin with A/B Testing

**Outcome:** Pass with gaps

**Gap 1 — High: No sunset criteria for the two-codebase comparison period.**
The ADR describes a two-phase approach (RN Phase 1, Kotlin Phase 2 with A/B comparison) but does not define:
- What metrics or thresholds constitute a "conclusion" to the comparison
- How long the comparison period runs before a winner is selected
- What happens to the losing codebase after the comparison

Without defined exit criteria, the two-codebase maintenance burden becomes indefinite. This is shared with ADR-012. → **Issue #41**

**Gap 2 — High: Event taxonomy CI enforcement is documented as a requirement but not yet implemented.**
ADR-012 documents that CI must validate that `AnalyticsConstants.kt` (Kotlin) matches `packages/types/src/analytics.ts` (TypeScript). Without this enforcement, event taxonomy drift will silently invalidate the RN-vs-Kotlin A/B comparison. This needs a CI step before mobile development begins. → **Issue #41** (same issue; shared root cause)

---

### ADR-009 — Infrastructure — GKE Autopilot and Cloud Run

**Outcome:** Pass

The GKE vs. Cloud Run A/B comparison is one of the most thoroughly designed decisions in the set. Cost model, performance metrics (p50/p95/p99 latency, scale-out time, cold-start), and comparison methodology (BigQuery, k6) are all specified. The cost crossover risk (GKE has a billing floor; Cloud Run is effectively free at low traffic) is documented and accepted as a deliberate choice to prioritize portfolio signal.

Terraform manages both platforms. Helm charts manage Kubernetes. Traffic split (90/10) is Terraform-controlled. HPA configuration (min 2, max 10, CPU 70%) is present. All references are official GCP documentation.

No gaps found.

---

### ADR-010 — Multi-Tenancy Data Isolation

**Outcome:** Pass

The shared-schema + RLS approach is well-suited to the current scale. The compliance analysis is one of the strongest sections across all ADRs: GDPR Article 17, HIPAA Security Rule, and SOC 2 Type II are each addressed with specific implications and migration paths if requirements change. The decision correctly acknowledges that fitness data is not currently regulated, and explicitly bounds the migration path (shared → schema-per-tenant is a defined operation via `IRepositoryFactory`).

Row-Level Security policy SQL is included and correct (`current_setting('app.current_user_id')`). This must be set in the NestJS request context before any Postgres query executes — that wiring is the responsibility of the auth integration, appropriately deferred to implementation.

No gaps found.

---

### ADR-011 — API Server — NestJS and Express

**Outcome:** Pass with gaps

**Gap 1 — Low: No archival policy for the Express reference implementation.**
The ADR correctly positions Express as a reference/comparison implementation, not a production target. However, there is no policy for:
- When the Express codebase stops receiving feature parity updates
- Whether it is archived or deleted after the comparison is documented

Without this, there is risk of implicit feature parity maintenance pressure as the NestJS implementation grows. → **Issue #42**

NestJS startup overhead (2–5s at 40–60 modules) is documented as an accepted risk. Fastify vs. Express middleware compatibility is flagged. The module/decorator structure is mapped. No critical gaps.

---

### ADR-012 — Analytics and A/B Testing

**Outcome:** Pass with gaps

The shared event taxonomy in `packages/types` is the right call — it is the single mechanism that makes the RN-vs-Kotlin comparison valid. The `client: ClientType` discriminator on every event is correctly designed for segmentation.

**Gap 1 — High: CI enforcement of TypeScript ↔ Kotlin event taxonomy sync is not yet implemented.**
This is the same gap flagged in ADR-008. Without it, the A/B comparison is at risk. See **Issue #41**.

Optimizely SDK availability for both React Native and Android is verified in the ADR. Firebase Analytics export to BigQuery for deeper analysis is recommended. References are official SDK documentation.

---

### ADR-013 — Testing Strategy

**Outcome:** Pass

This is the most recent ADR and directly addresses the historical GAS incident (mock/real divergence). The "real stores only for adapter tests" rule, enforced by Testcontainers (Postgres) and a dedicated test spreadsheet (Sheets), is the correct response. The test pyramid, co-location convention, dual-transport deduplication rule, and in-memory adapter policy are all clearly documented.

Known limitations are honestly stated:
- Sheets integration tests require `TEST_SHEETS_SPREADSHEET_ID`; skipped in CI until secret is provisioned (acknowledged CI coverage gap)
- Playwright E2E deferred to v0.2 (first deployed endpoint)
- Testcontainers requires Docker in CI (GHA satisfies this)

No gaps found.

---

## Cross-ADR Consistency Check

The following cross-ADR dependencies were verified as consistent:

| Dependency | ADRs | Status |
|---|---|---|
| Hexagonal dependency rule enforced by ESLint | ADR-002 → ADR-001 | Consistent |
| Per-request adapter resolution via `IRepositoryFactory` | ADR-003 → ADR-002 | Consistent |
| Sheets and Postgres adapters implement port interfaces | ADR-004 → ADR-002, ADR-003 | Consistent |
| JWT `sub` claim as `user_id` FK | ADR-005 → ADR-003, ADR-010 | Consistent |
| NestJS DI wires `IRepositoryFactory` and `IAuthProvider` | ADR-011 → ADR-002, ADR-003, ADR-005 | Consistent |
| Dual transport backed by same core services | ADR-006 → ADR-002 | Consistent |
| DataLoader must not leak between requests | ADR-006 → ADR-003 | **Gap → #40** |
| Event taxonomy in `packages/types` consumed by both mobile clients | ADR-012 → ADR-008 | Consistent (CI enforcement gap → #41) |
| Testcontainers runs Prisma migrations | ADR-013 → ADR-004 | Consistent |
| Next.js fetch semantics enforced by coding standard | ADR-007 → docs/standards | Consistent |
| GKE HPA minimum 2 replicas implies stateless API design | ADR-009 → ADR-002 (no shared in-process state) | Consistent |

No contradictions found between accepted ADRs.

---

## Follow-Up Issues Filed

| Issue | Title | Severity | Milestone | Epic |
|---|---|---|---|---|
| #38 | [docs] ADR-014 — Credential encryption at rest for Sheets adapter_config | High | v0.2 | Architecture & Documentation |
| #39 | [docs] Document cache invalidation strategy for IRepositoryFactory user_data_source lookup | Medium | v0.2 | Architecture & Documentation |
| #40 | [docs] ADR-015 — GraphQL DataLoader design: scope, batching, and request isolation | High | v0.2 | Port Interfaces |
| #41 | [docs] Define A/B comparison exit criteria and CI event taxonomy enforcement | High | v0.3 | Architecture & Documentation |
| #42 | [docs] Define archival policy for Express legacy comparison codebase | Low | v0.2 | Architecture & Documentation |

---

## Overall Assessment

The Foundation milestone architecture is sound. The hexagonal boundary is enforced at lint time. Testing strategy directly addresses the only known production failure mode from the predecessor project. Security and compliance posture is documented with explicit migration paths.

The five follow-up issues are improvements, not blocking problems. All gaps are in the High-or-below severity range; none prevents safe implementation to begin on v0.2 scaffolding issues.

The architecture is ready for Foundation milestone close.
