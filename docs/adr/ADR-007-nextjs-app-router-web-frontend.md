# ADR-007: Next.js App Router for Web Frontend

**Status:** Accepted
**Date:** 2026-04-03
**Reviewed:** 2026-04-07
**Review outcome:** Pass

---

## Context

The web frontend must replace the spreadsheet UI entirely, providing workout logging, training
max management, cycle dashboard visualization, and lift record history. The frontend must work
against the backend API defined in [ADR-006](ADR-006-rest-and-graphql-dual-transport.md) and
authenticate via the provider chosen in [ADR-005](ADR-005-authentication-strategy.md).

The choice is between **Next.js (App Router)** and **bare React (e.g., Vite + React Router)**.
Note: Next.js is a framework built on React — this is not a choice between React and something
else, but between a bare React SPA setup and a full-stack React framework.

---

## Decision

Use **Next.js with the App Router** (Next.js 14+).

- React Server Components (RSC) for data-fetching pages that do not require interactivity
- Client Components (`"use client"`) for interactive workout logging UI
- Clerk's Next.js SDK for authentication (`@clerk/nextjs`)
- The Next.js app calls the backend API (`apps/api`) — it does not use Next.js API routes as a
  backend, keeping the API independently deployable and usable by the mobile client

---

## Rationale

**Next.js vs. bare React (Vite):**
- **React Server Components** are the current frontier of React development (2025–2026). The
  App Router's server/client component model is the direction the React core team has committed
  to. Demonstrating fluency with RSC shows currency with the ecosystem.
- **File-based routing** reduces boilerplate. App Router's nested layouts are well-suited to
  the dashboard-style UI this application needs (e.g., a persistent nav with per-page content).
- **Streaming and Suspense** enable progressive rendering of data-heavy pages (e.g., a cycle
  dashboard with multiple data fetches) without client-side loading spinners.
- **Image optimization, font loading, and bundle splitting** come for free.
- **Portfolio signal:** Next.js App Router is the standard choice for production React
  applications as of 2025. Demonstrating it shows alignment with industry practice.

**Why not use Next.js API routes as the backend:**
- The backend must be independently deployable (Kubernetes / Cloud Run — [ADR-009](ADR-009-infrastructure-kubernetes-cloud-run.md)) and consumed
  by both web and mobile clients. Tying the API to the Next.js server would couple the web
  deployment to the API lifecycle and exclude mobile clients from using the same endpoints.

---

## Consequences

- The server/client component boundary requires deliberate attention. Data fetching happens in
  Server Components; event handlers and stateful UI happen in Client Components.
- Clerk's Next.js SDK provides middleware-based auth that works cleanly with the App Router.
- The Next.js app is deployed as a separate container from the API server. In Kubernetes, this
  is a separate Deployment; on Cloud Run, a separate service.
- Testing strategy: Server Components are tested with integration tests (next/jest); Client
  Components are tested with React Testing Library.
- **Fetch caching semantics must be set explicitly on every `fetch()` call in Server
  Components.** In Next.js 14, `fetch()` was cached aggressively by default (no expiry),
  causing stale data bugs in production. Next.js 15 reversed this: `fetch()` is uncached by
  default. Relying on either default is unsafe across major version upgrades. All `fetch()`
  calls in `apps/web` Server Components must specify `{ cache: 'no-store' }` (always-fresh) or
  `{ next: { revalidate: N } }` (time-based revalidation) explicitly — no reliance on defaults.
  See [docs/standards/fetch-cache-semantics.md](../standards/fetch-cache-semantics.md) and the
  [Next.js 15 Upgrade Guide](https://nextjs.org/docs/app/building-your-application/upgrading/version-15).

---

## Alternatives Considered

**Vite + React + React Router:** Simpler setup, pure SPA, no server/client boundary to reason
about. Appropriate for teams not yet investing in RSC. Ruled out because the App Router's
patterns are more representative of where the ecosystem is heading, which serves the portfolio
goal.

**Remix:** Another full-stack React framework with strong data loading patterns. Excellent
choice, but smaller ecosystem than Next.js. Ruled out on portfolio visibility grounds.

**Vue or Svelte:** Viable frontend frameworks. Ruled out because the codebase is TypeScript-
native and the team (and portfolio) is React-focused.

---

## References

- [Next.js — App Router Documentation](https://nextjs.org/docs/app) — Official App Router docs; covers Server Components, Client Components, routing, layouts, and Suspense streaming.
- [React — Server Components](https://react.dev/reference/rsc/server-components) — The React core team's reference documentation for React Server Components, the model the App Router is built on.
- [Next.js — Loading UI and Streaming](https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming) — How Suspense boundaries and `loading.tsx` enable progressive rendering; cited in the Rationale section.
- [Clerk — Next.js SDK](https://clerk.com/docs/references/nextjs/overview) — The `@clerk/nextjs` SDK providing middleware-based authentication for the App Router.
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/) — The testing approach for Client Components cited in the Consequences section.
- [Next.js 15 Upgrade Guide](https://nextjs.org/docs/app/building-your-application/upgrading/version-15) — Documents the reversal of the default `fetch` caching behaviour between Next.js 14 and 15; directly relevant to the caching risk identified in the case study.
- [Next.js — fetch API reference](https://nextjs.org/docs/app/api-reference/functions/fetch) — Documents the `cache` and `next.revalidate` options for `fetch()` in Server Components; the authoritative reference for the explicit cache semantics required by this ADR.
- [Vercel Engineering Blog](https://vercel.com/blog/engineering) — Posts by the Next.js team on App Router adoption patterns and production operational experience.
- [Case Study: Next.js App Router in Production](../case-studies.md#nextjs-app-router-in-production) — Documents the aggressive-caching default issue (Next.js 14 → 15) and the `useSearchParams` Suspense requirement as the primary production pain points.
