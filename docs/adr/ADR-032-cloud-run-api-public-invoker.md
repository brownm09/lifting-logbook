# ADR-032: API Cloud Run Service Is Publicly Invokable; Clerk Auth Is the Real Boundary

**Status:** Accepted
**Date:** 2026-07-09
**Closes:** [#766](https://github.com/brownm09/lifting-logbook/issues/766)
**Related:** [ADR-028](ADR-028-web-runtime-public-config.md) (runtime `PUBLIC_API_URL` injection), [ADR-009](ADR-009-infrastructure-kubernetes-cloud-run.md) (Cloud Run/GKE topology)

---

## Context

Since the original infrastructure scaffold (PR #157, 2026-05-02), the API Cloud Run service has
required Cloud Run IAM authentication: `infra/terraform/cloud-run.tf` granted `roles/run.invoker`
only to the web server's own workload service account, and `.github/workflows/deploy.yml` passed
`--no-allow-unauthenticated` on every `gcloud run deploy` of the API. The model was: the web
service is the only legitimate caller, authenticating server-to-server with a Google-signed
identity token.

On 2026-06-11, [ADR-028](ADR-028-web-runtime-public-config.md) (PR #515) introduced
`PUBLIC_API_URL`, injected into the browser at runtime and set to the API's external Cloud Run
URL — deliberately enabling Client Components to call the API directly from the browser, bearing
only a Clerk JWT (`apps/web/lib/client-api.ts`'s "AUTH HEADER INVARIANT" comment: *"there is no
Cloud Run IAM hop on the client path, so no header collision"*; `CONTRIBUTING.md:97` documents the
same assumption).

That assumption was never true in production. A browser cannot present a Google Cloud identity
token, and per the CORS spec a preflight `OPTIONS` request cannot carry the application's own
auth headers at all — so every cross-origin browser call to the IAM-locked API service was
rejected by Cloud Run's front end with `403` before the request reached NestJS, Clerk
verification, or any application code. Discovered via a live production investigation
(2026-07-09): the reschedule-workout feature (and, by the same mechanism, all 12 mutation
operations exported from `apps/web/lib/client-api.ts` — lift records, skip/unskip, body weight,
overrides, imports) had been silently broken in production, and in staging's Cloud Run A/B
replica, since ADR-028 shipped roughly a month earlier. Nothing caught it: there is no frontend
test exercising these calls against a real Cloud Run deployment, and the reschedule form's error
handler discarded the failure without logging it.

## Decision

Grant `roles/run.invoker` to `allUsers` on the API Cloud Run service, and stop passing
`--no-allow-unauthenticated` on its deploys (both staging and production). Cloud Run IAM no
longer gates the API; **Clerk JWT verification (`apps/api/src/auth/auth.guard.ts`) is the actual,
and now sole, authorization boundary** — the same model the web service has used successfully
since day one.

This is not a new exposure class. The web service has been `allUsers`-invokable from the start,
with Clerk (via `AuthModule`/`CurrentUser`) as its real gate; extending the identical pattern to
the API is a proven model, not an experiment. `web_invoker_on_api` (the web workload SA's
`run.invoker` grant on the API) is kept even though it's no longer strictly required for
access — the web server's server-to-server calls still present a real GCP identity token
alongside the Clerk JWT (via the separate `X-Clerk-Authorization` header), which is harmless and
gives that traffic a distinct IAM audit trail from anonymous callers.

## Consequences

**Positive:**
- Restores the architecture ADR-028 already committed to: the browser can call
  `PUBLIC_API_URL` directly, matching the documented (and now actually-true) "no Cloud Run IAM
  hop on the client path" invariant.
- Fixes a ~month-long silent production outage of every client-side write operation.
- One consistent access-control model across both Cloud Run services, instead of two
  irreconcilable ones.

**Negative / accepted risk:**
- The API is now directly reachable by anyone on the internet, not just the web service. Mitigant:
  every real endpoint already requires a valid Clerk session via the global `AuthGuard`; `@Public`
  routes (`/health`, `/readyz`, `/livez`) are intentionally unauthenticated probes with no
  sensitive data or side effects. This removes Cloud Run IAM as a redundant outer layer, not as
  the layer actually protecting user data.
- Un-authenticated traffic (scanners, bots) can now reach the API container directly rather than
  being stopped at Cloud Run's front end, which was previously an incidental DDoS/scan filter.
  Not addressed by this ADR — a rate-limiting or Cloud Armor gate is a reasonable follow-up if
  this proves to matter in practice, but is not required to close the correctness/security gap
  this ADR fixes.

## Alternatives Considered

### Proxy all client-side mutations through the Next.js server instead

Change every Client Component currently calling `PUBLIC_API_URL` directly (12 operations) to
route through a Next.js Server Action or Route Handler, which then calls the API server-to-server
under the existing IAM-locked model. **Rejected for this fix:** this reverses ADR-028's
deliberate, recently-shipped design rather than reconciling the infra with it, requires touching
every mutation call site instead of one Terraform resource and one CI flag, and would itself need
a new ADR justifying the reversal. Worth reconsidering only if a concrete need for the extra
Cloud Run IAM layer emerges later.

## Verification

- Staging: after deploy, replay the previously-failing CORS preflight
  (`curl -X OPTIONS -H "Origin: https://staging.liftinglogbook.com" -H "Access-Control-Request-Method: PATCH" <staging-api-url>/programs/.../reschedule -i`)
  and confirm a `2xx`/CORS-headers response instead of `403`; exercise the reschedule form
  end-to-end in the running staging app.
- Production: same, after the production deploy step change lands.
- `gcloud run services get-iam-policy <service> --project=<project>` shows an `allUsers` /
  `roles/run.invoker` binding on the API service in both environments.

## References

- [Google Cloud Run — Authentication overview](https://cloud.google.com/run/docs/authenticating/overview) — the IAM-invoker model this ADR partially opts out of, and the public-invocation ("allUsers") pattern it opts into instead.
- [Google Cloud Run — Invoking a public (unauthenticated) service](https://cloud.google.com/run/docs/authenticating/public) — the specific `allUsers` grant used here, already in use for the web service.
- [MDN — CORS: Preflighted requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS#preflighted_requests) — documents why a preflight `OPTIONS` request cannot carry the actual request's custom auth headers, which is why no client-side header change could have worked around the Cloud Run IAM gate.
