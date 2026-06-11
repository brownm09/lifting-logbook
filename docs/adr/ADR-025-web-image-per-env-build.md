# ADR-025: Per-Environment Web Image Build

**Status:** Superseded by [ADR-028](ADR-028-web-runtime-public-config.md) (2026-06-11)
**Date:** 2026-05-31
**Closes:** [#388](https://github.com/brownm09/lifting-logbook/issues/388)
**Related:** [ADR-028](ADR-028-web-runtime-public-config.md) (supersedes — runtime injection), [ADR-022](ADR-022-monorepo-docker-build-strategy.md) (web Dockerfile structure), [ADR-009](ADR-009-infrastructure-kubernetes-cloud-run.md) (deploy targets), [#383](https://github.com/brownm09/lifting-logbook/pull/383), [#387](https://github.com/brownm09/lifting-logbook/pull/387), [#382](https://github.com/brownm09/lifting-logbook/issues/382)

> **Superseded (2026-06-11):** [ADR-028](ADR-028-web-runtime-public-config.md) eliminates the
> build-time embedding entirely by injecting public config at runtime, restoring the
> single build-once / promote-everywhere web image this ADR's per-env builds gave up.
> The Phase-2 follow-up named below is that work ([#396](https://github.com/brownm09/lifting-logbook/issues/396)).
> The per-env build steps, the `-staging` / `-prod` image tags, and the bundle-grep
> verification described here no longer reflect the pipeline.

---

## Context

`apps/web/Dockerfile` is a Next.js App Router build. Next.js inlines any `NEXT_PUBLIC_*`
environment variable into the client JS bundle **at build time** — the value is literally
substituted into the compiled JavaScript shipped to browsers and embedded in Cloud Run /
GKE container images. Two such variables are currently consumed as Docker build-args:

- `NEXT_PUBLIC_API_URL` — the Cloud Run API URL the web frontend calls.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — the Clerk frontend key required by `<ClerkProvider>`
  in the root layout. Without it, `next build` aborts during `/_not-found` prerender.

Prior to this ADR, `.github/workflows/deploy.yml`'s `build-images` job resolved both values
from the **staging** project whenever `staging_enabled == true`, built a single
`web:${{ github.sha }}` image, and let both `deploy-staging` and `deploy-production` pull
that same tag. The production web pod therefore served a JS bundle with staging values
inlined — invisible while staging and production share infrastructure, but a guaranteed
silent production break the moment they don't (separate Clerk instances per env, separate
API hosts, separate publishable keys).

This is the same failure shape as [#382](https://github.com/brownm09/lifting-logbook/issues/382)
at a different layer. Two recent fixes — [#383](https://github.com/brownm09/lifting-logbook/pull/383)
(runtime `CLERK_SECRET_KEY`) and [#387](https://github.com/brownm09/lifting-logbook/pull/387)
(build-time `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`) — addressed individual symptoms of the
broader pattern "Clerk credential not wired through deploy pipeline" but preserved the
inherited "use staging value, deploy to both" shortcut. This ADR fixes the root pattern.

## Decision

Build the web image **twice per pipeline run** when staging is enabled, with
environment-specific build-args:

- `web:${{ github.sha }}-staging` — built with staging `NEXT_PUBLIC_*` values; deployed
  exclusively to staging.
- `web:${{ github.sha }}-prod` — built with production `NEXT_PUBLIC_*` values; deployed
  exclusively to production. Also tagged `:latest`.

In production-only mode (no staging configured), only the `-prod` image is built.

The `api` image is unchanged — it has no `NEXT_PUBLIC_*` build-args and continues to follow
build-once / promote-everywhere.

### Explicit trade

This decision **breaks the byte-identical promotion contract for the web image**. The image
exercised by the `smoke-test` job in staging is no longer the same artifact deployed to
production; the two differ in the values of `NEXT_PUBLIC_API_URL` and
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (and any future `NEXT_PUBLIC_*` value) embedded in the
JS bundle. The staging gate validates the image's **structure and runtime behavior** — that
`next build` succeeded, that the standalone server boots, that `/` returns 200 — not its
embedded public config. Production-specific embedded values are not exercised by any
automated check prior to production deploy; the "deliberate dry-run" in the
[Verification](#verification) section is the only check that production-specific values are
correctly baked.

This trade is acceptable because the alternative (option discussed below) preserves the
contract but ships wrong values to production. Phase 2 (see [Follow-up](#follow-up))
restores the contract by eliminating the build-time embedding entirely.

## Consequences

**Positive:**
- Production web pod serves a bundle with production `NEXT_PUBLIC_*` values. Staging serves
  staging values. The two environments are decoupled at the artifact level.
- Each image is a sealed, auditable artifact — "does this image have the right key baked
  in?" is answered by the tag.
- No application code changes; isolated to the deploy pipeline.

**Negative:**
- Web image build time roughly doubles on the staging-enabled path (two
  `RUN npx turbo run build` invocations; the install layers cache across both). Empirically
  ~2–3 minutes added per deploy on current build sizes.
- Artifact Registry storage for the web image roughly doubles (two SHA-tagged images per
  commit instead of one). Negligible at current scale.
- Every new `NEXT_PUBLIC_*` value going forward must be wired into **both** build invocations
  in `build-images` and resolved twice (staging + prod secret lookups). The cost of forgetting
  is the original bug. Mitigation: a checklist in [`docs/deploy.md`](../deploy.md) under
  "Adding a new `NEXT_PUBLIC_*` variable".
- The smoke-test gate no longer guarantees that the production-tagged artifact will boot
  successfully — only that the staging-tagged sibling does. A `next build` failure caused by
  a malformed production-only value (e.g., a Clerk publishable key with a typo in the prod
  secret) is caught at `build-images` time (the prod build step fails the pipeline), but a
  runtime issue specific to the prod image's embedded values would only surface in production.

## Alternatives Considered

### Runtime public config (deferred to follow-up)

Refactor `apps/web` to inject `NEXT_PUBLIC_*` values at runtime — either via a
server-rendered `<script>` in the root layout that sets a `window.__PUBLIC_CONFIG__` global
before the client React tree mounts, or via a Server Component that fetches the values and
passes them through React context. Remove `ARG NEXT_PUBLIC_*` from the Dockerfile. Restore
single-image build-once / promote-everywhere.

**Why deferred:** the refactor touches the `<ClerkProvider>` bootstrap path — the same
codepath that [#383](https://github.com/brownm09/lifting-logbook/pull/383) and
[#387](https://github.com/brownm09/lifting-logbook/pull/387) just stabilized. It also has
its own regression surface (any client component reading `process.env.NEXT_PUBLIC_*`
directly), warrants its own ADR documenting the bootstrap pattern chosen, and should not
block closing [#388](https://github.com/brownm09/lifting-logbook/issues/388). Tracked as a
follow-up issue that, once shipped, will supersede this ADR.

### Promote prod build to staging

Build one image with **production** values and deploy it to both staging and production.
Trivial pipeline change. Rejected: staging then exercises Clerk's production tenant and
calls the production API URL, defeating the purpose of having a separate staging
environment for those components and creating a real risk of staging-originated traffic
mutating production-Clerk user state.

## Verification

- **CI:** `deploy.yml` runs on every push to `main`. A push of this branch validates that
  the two-build path succeeds end-to-end (both `web:<sha>-staging` and `web:<sha>-prod`
  built, pushed, and pulled by the corresponding deploy jobs).
- **Smoke test:** existing `smoke-test` job continues to validate the staging-tagged image.
- **Deliberate dry-run (AC #3 of [#388](https://github.com/brownm09/lifting-logbook/issues/388)):**
  after the first deploy on this branch, follow the procedure in
  [`docs/deploy.md`](../deploy.md) → "Verifying per-env web image build" to grep the served
  JS bundle in each environment for the **other** environment's Clerk publishable key
  prefix and API URL hostname. Both must be absent.

## Cross-project Artifact Registry note

In staging-enabled mode, both web image variants (`web:<sha>-staging` and
`web:<sha>-prod`) are pushed to the **staging** project's Artifact Registry
(`steps.ar.outputs.repo` resolves from `terraform-staging.outputs.ar_repo`),
while `deploy-production` pulls images from the **production** project's AR
(`steps.tf-prod.outputs.ar_repo`). This asymmetry is **not new** to this ADR
— the API image has the same shape today (built at `steps.ar.outputs.repo`,
deployed from `steps.tf-prod.outputs.ar_repo`) — but it deserves explicit
mention because per-env image tags make the cross-project pull path more
load-bearing.

This works in practice via one of two mechanisms (both currently in use):

1. **Production-only mode** (`staging_enabled == false`): the preflight job
   hardcodes `ar_repo` to the prod project (`deploy.yml` line ~58), and
   `terraform-production.outputs.ar_repo` resolves to the same value. The
   "asymmetry" collapses to a no-op.
2. **Staging-enabled mode**: the production service accounts hold an
   `artifactregistry.reader` IAM grant on the staging project's AR, so prod
   GKE/Cloud Run can pull the prod-tagged image from the staging AR. This
   grant must be in place before any production deploy succeeds.

Per-env AR routing (each environment publishing to its own AR) is the
cleaner long-term shape and is tracked as a follow-up to this ADR. Until
then, do not remove the cross-project IAM grant without also moving the
production push target.

## Follow-up

Two follow-ups are tracked:

1. **Runtime public config (Phase 2):** open a separate `[design]` issue
   titled "Refactor apps/web public config to runtime injection (supersedes
   ADR-025)" immediately after [#388](https://github.com/brownm09/lifting-logbook/issues/388)
   closes. That work will supersede this ADR by removing the build-time
   embedding entirely.
2. **Per-env AR routing:** track separately. Push each environment's image
   variant to that environment's AR, eliminating the cross-project pull
   dependency.

## First-time prod bootstrap

The `Resolve production API URL` step calls
`gcloud run services describe lifting-logbook-prod-api` from `build-images`,
which runs **before** `deploy-production` (where `terraform-production`
creates the service). On the very first deploy to a new prod project (where
the prod Cloud Run API service does not yet exist), this step fails and
aborts the entire `build-images` job — including any in-flight staging
deploy.

This is a one-time bootstrap concern. Recovery procedure:

1. Run the pipeline once in **production-only mode** (do not set
   `GCP_STAGING_WORKLOAD_IDENTITY_PROVIDER`). The prod-only path does not
   depend on the prod Cloud Run service existing because the URL resolution
   is the same `describe` call — so this still fails on bootstrap. Instead:
2. Run `terraform apply` against the production workspace manually from a
   workstation with prod credentials. This creates the prod Cloud Run API
   service.
3. Re-run the CI pipeline. `Resolve production API URL` now succeeds.

A cleaner long-term shape (depending on `terraform-production` outputs from
`build-images`) is blocked by the current job DAG: `terraform-production`
runs as a *step* inside `deploy-production`, which depends on `build-images`.
Restructuring requires hoisting `terraform-production` to its own job — out
of scope for this ADR.

## References

- [Next.js — Configuring Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables) —
  Authoritative on `NEXT_PUBLIC_*` build-time inlining: "the value will be inlined into
  JavaScript sent to the browser" and is fixed at build time, not runtime.
- [Docker — `ARG` and build-time variables](https://docs.docker.com/engine/reference/builder/#arg) —
  Build-arg semantics; a build-arg change invalidates downstream layer cache, which is why
  the two build invocations re-execute `RUN npx turbo run build` despite sharing the
  install layers.
- [Clerk — Publishable Key](https://clerk.com/docs/deployments/clerk-environment-variables#clerk-publishable-key) —
  Documents that the publishable key is environment-bound (one key per Clerk instance) and
  is required by `<ClerkProvider>` at client mount.
- [`docker/build-push-action`](https://github.com/docker/build-push-action) — The GitHub
  Action used to invoke `docker build`; `cache-from`/`cache-to: type=gha` semantics for
  GitHub Actions layer cache reuse between the staging and prod builds.
