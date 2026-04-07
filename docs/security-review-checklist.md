# Security Review Checklist — First Authenticated Endpoint

**Gate:** This checklist must be completed and all findings resolved before the v0.2 milestone is closed.
**Scope:** Applies to the first authenticated API endpoint and the supporting infrastructure that ships with it.

---

## How to Use This Checklist

Work through each section before merging the first PR that introduces auth middleware or a protected route. Record findings as GitHub issues labelled `security`. Close the milestone only after all `security`-labelled issues are resolved or explicitly risk-accepted with documented rationale.

---

## 1. Authentication Token Handling (ADR-005)

The architecture uses Clerk (or Auth0) for token issuance. The API verifies JWTs via `IAuthProvider.verifyToken()`.

- [ ] JWT signature verified against the provider's public key on every request — not cached long-term without key rotation awareness
- [ ] Token expiry (`exp` claim) validated before accepting the token
- [ ] Tokens are transmitted only over HTTPS — no plaintext HTTP endpoints in non-local environments
- [ ] `Authorization: Bearer <token>` is the only accepted token delivery mechanism — cookies or query-string tokens are not accepted
- [ ] The `sub` claim is used as the canonical user ID — no trust placed in user-supplied IDs in request bodies for data ownership
- [ ] Provider SDK version (Clerk / Auth0) is pinned and on a supported release; review release notes for security advisories
- [ ] Token verification errors return `401 Unauthorized` with no implementation detail leaked in the response body

---

## 2. Session Storage (ADR-005)

Sessions are managed entirely by Clerk (or Auth0). The API is stateless.

- [ ] Confirm no server-side session state is stored in the API (no in-memory session store, no Redis session cache)
- [ ] Refresh token handling is delegated to the provider SDK — no custom refresh logic in `apps/api`
- [ ] If the web client stores tokens in `localStorage`, document the XSS risk and confirm a Content Security Policy is in place for `apps/web`
- [ ] If the web client stores tokens in `httpOnly` cookies, confirm `SameSite=Strict` or `SameSite=Lax` and `Secure` attributes are set
- [ ] Logout invalidates the session on the provider side (not just client-side token deletion)

---

## 3. Multi-Tenancy Data Isolation (ADR-010)

All user data tables use `user_id` scoping with Postgres Row-Level Security as defence-in-depth.

- [ ] Every query that reads or mutates user data includes a `WHERE user_id = :currentUserId` clause — no unscoped reads on user-data tables
- [ ] Postgres RLS is enabled on all user-data tables (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`)
- [ ] The `app.current_user_id` session variable is set by Prisma middleware before any query executes in a request context
- [ ] The Prisma middleware that sets `app.current_user_id` is covered by an integration test that verifies cross-user data is not accessible
- [ ] No endpoint accepts a `userId` parameter that overrides the authenticated user's ID (privilege escalation via parameter tampering)
- [ ] Administrative or system-level queries (migrations, health checks) use a separate database role that bypasses RLS intentionally, not the application role
- [ ] Confirm no N+1 or bulk-fetch pattern returns rows across multiple users in a single response

---

## 4. Input Validation

- [ ] All request bodies are validated against a schema (e.g., class-validator in NestJS) before reaching the service layer
- [ ] String fields have explicit maximum length constraints — unbounded strings are not passed to the database
- [ ] Numeric fields (weights, reps, sets) have range constraints — negative or absurdly large values are rejected
- [ ] IDs in path and query parameters are validated as the expected format (UUID, integer) before use in queries
- [ ] File upload endpoints (if any) validate MIME type and size limits server-side, not just client-side

---

## 5. OWASP Top 10 Applicability

Review each OWASP Top 10 (2021) category for applicability to this architecture. Mark N/A with a brief justification where not applicable.

| # | Category | Applicable? | Notes |
|---|---|---|---|
| A01 | Broken Access Control | Yes | Primary risk: cross-user data access. Mitigated by `user_id` scoping + RLS (ADR-010). Verify with integration tests. |
| A02 | Cryptographic Failures | Partial | Tokens and data in transit are covered by TLS + Clerk. Confirm data at rest encryption for Cloud SQL (GCP default). No custom crypto in application code. |
| A03 | Injection | Yes | SQL injection: Prisma uses parameterised queries; verify no raw query strings are constructed with user input. Verify NestJS DTO validation rejects unexpected fields. |
| A04 | Insecure Design | Partial | Architecture review (ADR-005, ADR-010) mitigates structural risks. Confirm threat model is documented before v0.2 close. |
| A05 | Security Misconfiguration | Yes | Review: CORS policy (should not be `*` in production), HTTP security headers (`Helmet` in NestJS), error responses do not expose stack traces. |
| A06 | Vulnerable and Outdated Components | Yes | Run `npm audit` before v0.2 merge freeze. Address critical and high severity findings. |
| A07 | Identification and Authentication Failures | Yes | Covered by Items 1 and 2 above. Confirm no fallback to a weaker auth path exists. |
| A08 | Software and Data Integrity Failures | Partial | CI pipeline should verify package integrity (lock file integrity check). No deserialization of untrusted objects expected. |
| A09 | Security Logging and Monitoring Failures | Yes | Auth failures (`401`, `403`) must be logged with enough context to detect brute-force patterns. Do not log token values. |
| A10 | Server-Side Request Forgery | Low | No user-controlled URLs are fetched server-side in the current design. Re-evaluate if webhooks or external data fetch features are added. |

---

## 6. Security Headers and Transport

- [ ] `Helmet` middleware (or equivalent) is enabled in `apps/api` — covers `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, etc.
- [ ] CORS is configured to an explicit allowlist — not `*` in staging or production environments
- [ ] API does not serve user-uploaded content from the same origin (avoids stored XSS via content-type sniffing)
- [ ] Cloud Run / GKE ingress is configured to reject non-HTTPS traffic and redirect to HTTPS

---

## 7. Dependency Audit

- [ ] `npm audit --audit-level=high` passes with zero high or critical findings
- [ ] Provider SDKs (Clerk, Auth0) are on the latest stable release
- [ ] Prisma client is on the latest patch release for the current minor version
- [ ] NestJS and its security-relevant plugins (`@nestjs/passport`, JWT guard) are on supported versions

---

## 8. Review Sign-Off

| Reviewer | Role | Date | Outcome |
|---|---|---|---|
| | | | Pass / Pass with findings / Fail |

**Findings:** Link any GitHub issues opened as a result of this review.

---

## References

- [OWASP Top 10 (2021)](https://owasp.org/Top10/) — The ten most critical web application security risks; used as the framework for Section 5.
- [RFC 6749 — The OAuth 2.0 Authorization Framework](https://datatracker.ietf.org/doc/html/rfc6749) — The specification underlying the JWT-based auth flow in ADR-005.
- [RFC 7636 — PKCE](https://datatracker.ietf.org/doc/html/rfc7636) — The PKCE extension that prevents authorisation code interception; relevant to the Clerk/Auth0 flow.
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) — Practical guidance for implementing and reviewing authentication mechanisms.
- [OWASP SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html) — Parameterised query requirements referenced in A03.
- [PostgreSQL — Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html) — The RLS feature used as the data isolation defence-in-depth layer (ADR-010).
- [NestJS — Security](https://docs.nestjs.com/security/helmet) — Official NestJS docs covering Helmet, CORS, rate limiting, and CSRF protection.
- [Clerk — Security](https://clerk.com/docs/security/overview) — Clerk's security model; documents token verification, session management, and compliance posture.
