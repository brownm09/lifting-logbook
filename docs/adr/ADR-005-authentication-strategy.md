# ADR-005: Authentication Strategy

**Status:** Accepted
**Date:** 2026-04-03
**Reviewed:** 2026-04-07
**Review outcome:** Pass

---

## Context

The cloud-native version requires authentication for all API access. The initial requirement is
Google OAuth (consistent with the Google Sheets data source and existing Google account usage).
Future requirements may include additional providers (email/password, GitHub, Apple, enterprise
SSO). Building OAuth flows from scratch is high-risk, high-maintenance work that does not
differentiate this application.

---

## Decision

Use a **managed identity provider** — specifically **Clerk** (primary choice) or **Auth0**
(equivalent alternative) — for token issuance, session management, and social provider
integration.

Internally, the application never depends directly on Clerk or Auth0. All auth interactions go
through an `IAuthProvider` interface:

```typescript
interface AuthUser {
  id: string;          // Stable internal user identifier
  email: string;
  provider: string;    // 'google', 'github', 'email', etc.
  displayName?: string;
}

interface IAuthProvider {
  verifyToken(token: string): Promise<AuthUser>;
}
```

The Clerk adapter implements this interface. If the provider is replaced, only the adapter
changes. HTTP handlers and core services are unaffected.

### Flow

1. The web/mobile client authenticates directly with Clerk (using Clerk's SDK).
2. The client includes the resulting JWT in `Authorization: Bearer <token>` on every API request.
3. The API's auth middleware calls `authProvider.verifyToken(token)` to obtain the `AuthUser`.
4. The `AuthUser` is attached to the request context and used downstream for data scoping and
   per-user adapter resolution ([ADR-003](ADR-003-per-user-data-store-config.md)).

---

## Rationale

**Why a managed provider instead of custom OAuth:**
- OAuth 2.0 + OIDC implementation is complex and security-sensitive. Vulnerabilities in custom
  auth implementations are a leading source of breaches. The cost of getting it wrong is high.
- Managed providers handle: token rotation, PKCE, refresh token management, provider-specific
  quirks, MFA, and compliance certifications (SOC 2, GDPR).
- Adding a new provider (e.g., GitHub login) via Clerk is a configuration change, not a code
  change.

**Why Clerk over Auth0:**
- Clerk has a more modern developer experience and better React/Next.js integration.
- Auth0 is more widely known in enterprise contexts and may be a more recognizable name on a
  portfolio. Both are acceptable; Clerk is preferred for development velocity.
- The `IAuthProvider` abstraction means this choice is fully reversible.

**Why not Firebase Auth:**
- Firebase Auth is viable but ties more tightly to the Firebase ecosystem. Given that Postgres
  is the target data store (not Firestore), Firebase Auth introduces an ecosystem coupling
  without corresponding benefit.

---

## Consequences

- A Clerk (or Auth0) account and project are required. Both have free tiers sufficient for
  development and low-traffic production use.
- JWTs issued by Clerk include a stable `user_id` (the `sub` claim) that becomes the primary
  key for user data across all tables and the factory config lookup.
- If Clerk is deprecated or pricing changes, migration is bounded by the `IAuthProvider`
  interface: implement a new adapter, update DI wiring.

---

## Future Considerations

If this application were extended to enterprise B2B use cases, the auth layer would need to
support **SAML 2.0 / enterprise SSO**. Both Clerk and Auth0 support this on paid plans. The
`IAuthProvider` interface is unchanged — the adapter handles the SAML complexity.

For applications handling PHI (Protected Health Information) under HIPAA, the auth provider must
provide a signed Business Associate Agreement (BAA). Auth0 (on Enterprise plan) and Clerk (on
Enterprise plan) both offer BAAs. Custom OAuth implementations would need to be certified
independently, which is significantly more expensive.

---

## References

- [RFC 6749 — The OAuth 2.0 Authorization Framework](https://datatracker.ietf.org/doc/html/rfc6749) — The IETF specification for OAuth 2.0; defines the authorisation code, implicit, client credentials, and resource owner password flows.
- [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html) — The OIDC identity layer on top of OAuth 2.0; defines the ID token, `sub` claim, and UserInfo endpoint used by Clerk and Auth0.
- [RFC 7636 — Proof Key for Code Exchange (PKCE)](https://datatracker.ietf.org/doc/html/rfc7636) — The PKCE extension that prevents authorisation code interception attacks; referenced in the Rationale section.
- [OASIS SAML 2.0 Core Specification](https://docs.oasis-open.org/security/saml/v2.0/saml-core-2.0-os.pdf) — The enterprise SSO standard cited in the Future Considerations section.
- [Clerk — Documentation](https://clerk.com/docs) — Official Clerk developer docs; covers Next.js SDK, JWT verification, and organisation/session management.
- [Auth0 — Documentation](https://auth0.com/docs) — Official Auth0 developer docs; the primary alternative to Clerk.
