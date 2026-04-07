# Coding Standard: Explicit fetch() Cache Semantics in apps/web

**Applies to:** `apps/web` — all Server Component files (`app/**/*.tsx`, `app/**/*.ts`)  
**Status:** Active  
**Related ADR:** [ADR-007 — Next.js App Router Web Frontend](../adr/ADR-007-nextjs-app-router-web-frontend.md)

---

## Rule

Every `fetch()` call inside a Server Component in `apps/web` **must** specify a `cache` option
explicitly. Do not rely on Next.js defaults.

**Required patterns:**

```ts
// Always fetch fresh data — no caching
const res = await fetch('https://api.example.com/workouts', { cache: 'no-store' });

// Time-based revalidation (seconds)
const res = await fetch('https://api.example.com/lifts', { next: { revalidate: 60 } });
```

**Disallowed pattern:**

```ts
// BAD: relying on default cache behaviour — undefined across Next.js versions
const res = await fetch('https://api.example.com/workouts');
```

---

## Why

Next.js changed the default `fetch()` caching behaviour between major versions:

| Version | Default behaviour |
|---|---|
| Next.js 14 | `fetch()` is cached aggressively — no expiry |
| Next.js 15 | `fetch()` is uncached by default |

A Server Component that relies on the default will silently change behaviour on a Next.js major
upgrade. In Next.js 14, such code serves stale data to users indefinitely; in Next.js 15, it
bypasses the cache entirely. Neither outcome is intentional — both are silent failures.

Setting the `cache` option explicitly documents the intended behaviour and makes it immune to
version-level default changes.

**Primary source:** [Next.js 15 Upgrade Guide — Caching changes](https://nextjs.org/docs/app/building-your-application/upgrading/version-15)

---

## Choosing the Right Option

| Scenario | Option | Example |
|---|---|---|
| User-specific data (workouts, lift records, history) | `{ cache: 'no-store' }` | Workout history — must always reflect the latest entries |
| Shared reference data that changes infrequently | `{ next: { revalidate: N } }` | Exercise library — acceptable to serve data up to N seconds stale |
| Data fetched in a POST route handler or form action | `{ cache: 'no-store' }` | Mutations always bypass cache |

When in doubt, use `{ cache: 'no-store' }`. A stale workout log is a worse user-facing failure
than a redundant API call.

---

## ESLint Enforcement

The root `eslint.config.js` includes a `no-restricted-syntax` rule scoped to `apps/web/**`
that flags `fetch()` calls with no options argument:

```ts
// Flagged by ESLint — missing options entirely
await fetch(url);

// Not flagged by ESLint (cache/next must be verified in code review)
await fetch(url, { method: 'POST' });

// Correct — cache option explicit
await fetch(url, { cache: 'no-store' });
await fetch(url, { next: { revalidate: 60 } });
```

**Limitation:** The ESLint rule catches the zero-argument case only. A `fetch(url, { method: 'POST' })`
call without an explicit `cache` option is not caught automatically and must be caught in code
review using this standard as the reference.

---

## References

- [Next.js — fetch API reference](https://nextjs.org/docs/app/api-reference/functions/fetch) — `cache` and `next.revalidate` option documentation
- [Next.js 15 Upgrade Guide](https://nextjs.org/docs/app/building-your-application/upgrading/version-15) — documents the default cache behaviour reversal between Next.js 14 and 15
- [ADR-007 — Next.js App Router Web Frontend](../adr/ADR-007-nextjs-app-router-web-frontend.md) — architecture decision record that adopted this standard
