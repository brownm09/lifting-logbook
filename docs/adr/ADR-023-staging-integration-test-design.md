# ADR-023: Staging Integration Test Design

**Status:** Accepted
**Date:** 2026-05-26
**Supersedes:** ADR-013 §E2E (extends, does not replace)

---

## Context

[ADR-013](ADR-013-testing-strategy.md) established the test pyramid and deferred Playwright
staging E2E tests to v0.2 "when the first deployed endpoint exists." That milestone has been
reached: the staging environment (Cloud Run API + web) is operational, and issue #345 introduced
a CI gate that runs staging integration tests on every PR targeting `main`.

Two problems needed resolution before the tests could pass:

### 1. Authentication against a Clerk-protected staging environment

The staging app uses Clerk for authentication. The `apps/web` middleware protects all routes
except `/sign-in(.*)` and `/sign-up(.*)`. The Playwright global setup must sign in once and
save the session; individual tests reuse the saved `storageState`.

The initial approach — automating the Clerk sign-in form via `getByLabel` / `getByRole` — failed
for two reasons:

- **MFA**: The staging test account has TOTP/SMS second factor enabled. After the password step,
  Clerk redirects to `/sign-in/factor-two`. The UI flow cannot produce a TOTP code automatically.
  Disabling MFA on a shared staging account creates a security gap.

- **Strict-mode locator collisions**: The `<SignIn />` component renders a "Sign in with Google
  Continue" social button alongside the primary "Continue" form button. Playwright's strict mode
  rejects selectors that match multiple elements.

### 2. Server component error silencing

The Next.js server components swallow API errors gracefully:
- `ProgramsPage` — `.catch(() => DEFAULT_SETTINGS)` / `.catch(() => [])`
- `HistoryPage` — `.catch(() => [])` / `.catch(() => { entries: [] })`
- `CyclePage` — `try { … } catch { redirect('/onboarding') }`

This is correct product behavior (the app should not crash on transient API errors), but it means
tests 1–4 assert page *structure* only — they pass even if the API is completely down or returning
401 on every request. The tests provided no signal that auth propagation was working.

---

## Decision

### Auth strategy: Clerk Backend SDK sign-in token

Replace the UI-based sign-in flow with the [Clerk Backend SDK sign-in token](https://clerk.com/docs/reference/backend-api/tag/Sign-in-Tokens) strategy:

1. Use `createClerkClient({ secretKey }).signInTokens.createSignInToken({ userId, expiresInSeconds: 60 })` to create a one-time token for the test user.
2. Navigate to `/sign-in` to load the Clerk JS SDK into the browser context.
3. Wait for `window.Clerk.loaded` before calling SDK methods.
4. Use `page.evaluate()` to call `Clerk.client.signIn.create({ strategy: 'ticket', ticket })` then `Clerk.setActive()`.
5. Assert `not.toHaveURL(/\/sign-in/)` to confirm the session is active.
6. Save `storageState` for reuse by all tests.

Sign-in tokens bypass all authentication factors — including TOTP, SMS, and passkey — by design.
The test account may retain MFA enabled; no special Clerk configuration is required.

Required environment variables for global setup:

| Variable | Source | Purpose |
|---|---|---|
| `STAGING_WEB_URL` | workflow output | Base URL for navigation |
| `STAGING_CLERK_TEST_EMAIL` | `staging` environment secret | Identifies the test user |
| `CLERK_SECRET_KEY` | GCP Secret Manager | Backend SDK authentication |
| `CLERK_PUBLISHABLE_KEY` | GCP Secret Manager | `clerkSetup()` bot-detection bypass |

`STAGING_CLERK_TEST_PASSWORD` is no longer required.

### Explicit API auth propagation test

Add a fifth test that directly verifies the API accepts the Clerk JWT:

```typescript
// Retrieve session token from the active Clerk session in the browser.
const token = await page.evaluate(async () => {
  const cl = (window as any).Clerk;
  return cl?.session ? cl.session.getToken() : null;
});

// Call the API with the JWT — confirms auth propagation works end-to-end.
const response = await page.request.get(`${process.env.STAGING_API_URL}/users/me/settings`, {
  headers: { Authorization: `Bearer ${token}` },
});
expect(response.status()).toBe(200);
```

`GET /users/me/settings` returns 200 for any authenticated user regardless of data state, making
it a data-independent auth round-trip. `STAGING_API_URL` is injected from the `deploy-staging`
job output in the CI workflow.

### Sign-in page

The `<SignIn />` component requires a Next.js page at `app/sign-in/[[...sign-in]]/page.tsx`.
The catch-all route (`[[...sign-in]]`) matches all Clerk sub-paths (`/sign-in/factor-one`,
`/sign-in/sso-callback`, etc.) that the SDK may navigate to during the ticket flow.

---

## Rationale

**Sign-in token over UI automation:** The ticket strategy is Clerk's documented mechanism for
CI/CD environments where interactive auth is impractical. It removes the brittleness of CSS
selector changes in the Clerk component and the impossibility of TOTP code generation.

**Retaining MFA on the test account:** Disabling MFA to unblock UI-based automation would
reduce the security posture of the staging account. The sign-in token approach means MFA
configuration on the test account has no effect on CI, so there is no incentive to weaken it.

**Explicit API test alongside page tests:** The graceful-degradation pattern in server components
is correct for production (users should not see crashes on transient API errors), but it means
page-level assertions give no signal about API health. A direct API call in the test suite bridges
that gap without requiring a separate health-check endpoint or changes to the server components.

**`GET /users/me/settings` as the auth probe:** This endpoint is auth-gated, returns 200 for
any authenticated user (creates defaults on first call), and has no dependency on test data.
It is the lightest possible probe that exercises the full auth path.

---

## Consequences

- **Test account lifecycle:** The test account must exist in the staging Clerk instance and its
  email must be stored in the `staging` GitHub environment secret `STAGING_CLERK_TEST_EMAIL`.
  If the account is deleted, global setup throws a descriptive error. The account does not need
  a working password for CI (sign-in tokens bypass the password step), but Clerk requires a
  password at account creation.

- **Sign-in token TTL:** Tokens expire in 60 seconds. The browser navigation and `page.evaluate()`
  must complete within that window. In practice, global setup takes < 5 seconds, so 60 seconds
  is conservative.

- **Session token TTL in dev mode:** The Clerk staging instance uses a `pk_test_` publishable
  key (development mode). Development-mode session JWTs have a 60-second cache TTL on the
  server side. Tests that navigate to server-rendered pages may encounter expired tokens between
  the global setup and test 4. The server components handle this by redirecting or rendering
  empty — not crashing. The auth propagation test (test 5) uses `page.evaluate()` to obtain
  a fresh token immediately before the API call, sidestepping the TTL issue.

- **`@clerk/backend` as explicit dependency:** `@clerk/backend` is used directly in
  `staging.setup.ts` (`createClerkClient`). It is bundled transitively through `@clerk/nextjs`
  at a compatible version but must be listed explicitly in `package.json` devDependencies to
  prevent the dependency from being silently upgraded to an incompatible version.

- **Test scope:** Staging tests are intentionally narrow — they verify the deployed stack is
  wired correctly, not business logic. Business logic is covered by unit and integration tests
  per ADR-013. Adding data-assertions to staging tests (e.g., "specific lift record appears")
  would require seed data management, which is out of scope.

---

## Alternatives Considered

**UI-based sign-in with a no-MFA test account:**
A dedicated Clerk account with MFA disabled avoids the Backend SDK dependency. Rejected because:
it creates pressure to keep MFA off ("it will break CI"), and any developer or admin enabling
MFA on the test account would silently break CI with no obvious connection to the change.

**Separate Clerk application for staging tests with no MFA policy:**
A fully isolated Clerk app eliminates MFA concerns. Rejected because it doubles the Clerk
configuration surface (two sets of keys, two JWKS endpoints) and provides no practical benefit
over the sign-in token approach, which is already designed for this use case.

**Mock API in staging tests:**
Run a mock API server alongside Playwright tests instead of calling the real deployed API.
Rejected per ADR-013's principle of no mocks for repository adapters, and because staging tests
exist specifically to catch integration failures that unit/mock-based tests miss.

**Server-side health-check route (`/api/health`):**
A Next.js route handler that proxies to the backend and returns 200/503. Would let the test call
`/api/health` without needing `STAGING_API_URL`. Rejected because it adds a permanent production
route that exists only to serve a testing concern; the direct API call approach is cleaner.

---

## References

- [Clerk Backend API — Sign-in Tokens](https://clerk.com/docs/reference/backend-api/tag/Sign-in-Tokens) — Official documentation for the `createSignInToken` endpoint. Describes the ticket strategy and the `strategy: 'ticket'` parameter used in `signIn.create()`.
- [Clerk Testing — `@clerk/testing`](https://clerk.com/docs/testing/playwright/overview) — Official guide for Playwright integration: `clerkSetup()`, `setupClerkTestingToken()`, and the recommended `storageState` pattern for session reuse.
- [Playwright — Storage State](https://playwright.dev/docs/auth#reuse-signed-in-state) — The canonical pattern for sharing auth state across tests. The `storageState` save in global setup and load in `use.storageState` in the Playwright config implement this directly.
