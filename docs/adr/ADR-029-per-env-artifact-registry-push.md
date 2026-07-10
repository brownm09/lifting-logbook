# ADR-029: Per-Environment Artifact Registry Push

**Status:** Accepted
**Date:** 2026-06-11
**Closes:** [#397](https://github.com/brownm09/lifting-logbook/issues/397)
**Related:** [ADR-025](ADR-025-web-image-per-env-build.md) (updates its "Cross-project Artifact Registry note"), [ADR-028](ADR-028-web-runtime-public-config.md) (single `web:<sha>` image), [ADR-026](ADR-026-ci-action-version-pinning.md) (pinned `wretry`/build-push actions), [#411](https://github.com/brownm09/lifting-logbook/pull/411) (the imagetools copy this replaces), [#464](https://github.com/brownm09/lifting-logbook/issues/464) (architecture-review umbrella)

---

## Context

`build-images` in [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml) builds the
`api:<sha>` and `web:<sha>` images and, in **staging-enabled mode**, pushes them to the **staging**
project's Artifact Registry (`steps.ar.outputs.repo`). `deploy-production` pulls only from the
**production** project's AR (`steps.tf-prod.outputs.ar_repo`), so the images had to reach the prod
AR somehow.

The previous arrangement ([#411](https://github.com/brownm09/lifting-logbook/pull/411)) re-authed to
the prod CI/CD service account and ran `docker buildx imagetools create` to copy both images from the
staging AR into the prod AR. `imagetools create` is a registry-to-registry copy: it **reads the
source manifest from the staging AR** while authenticated as the prod SA. That cross-project *read*
required a standing `roles/artifactregistry.reader` grant on the staging AR for the prod SA,
provisioned in Terraform (`google_artifact_registry_repository_iam_member.external_readers`, fed by
`var.external_ar_reader_service_accounts` set in `terraform.tfvars.staging`).

[ADR-025](ADR-025-web-image-per-env-build.md) flagged this cross-project pull in its "Cross-project
Artifact Registry note" and named per-env AR routing as the cleaner long-term shape, deferring it to
a follow-up ([#397](https://github.com/brownm09/lifting-logbook/issues/397)). That standing
cross-project IAM grant is easy to break (a registry recreation or SA rotation silently breaks every
production deploy) and violates least privilege — the prod automation identity should not be able to
read the staging registry at all.

[ADR-028](ADR-028-web-runtime-public-config.md) (#396) then collapsed the per-env web image variants
back to a single env-agnostic `web:<sha>`, so **both** images are now identical artifacts that simply
need to land in both registries — which makes the clean fix straightforward.

## Decision

Replace the cross-project registry-to-registry **copy** (which *reads* the staging AR as the prod SA)
with a direct second **build-push to the prod AR** (which only *writes* the prod AR as the prod SA).

In `build-images`, staging-enabled mode:

1. Auth **staging** → build+push `api:<sha>` and `web:<sha>` to the **staging AR**. *(unchanged)*
2. Auth **prod** → build+push `api:<sha>` and `web:<sha>` straight to the **prod AR**
   (`steps.ar-prod.outputs.repo`), reusing the same per-image GHA cache scope. *(replaces the two
   `imagetools create` steps)*

Each push writes only its own project's AR with that project's own SA; the prod SA never touches the
staging AR. Because step 1 already exported the GHA layer cache (`cache-to: …,mode=max`), each prod
build in step 2 is a cache-resolve + push — no real rebuild. The prod build-push sets `cache-from`
only (no `cache-to`) to avoid re-exporting the cache the staging build already wrote.

Production-only mode (`staging_enabled == false`) is unchanged: the job auths prod and pushes once
directly to the prod AR, which `steps.ar.outputs.repo` already resolves to.

With no remaining cross-project read, the Terraform grant is removed: the `external_readers`
resource, the `external_ar_reader_service_accounts` variable, and its `terraform.tfvars.staging`
value are deleted. Applying this revokes the live grant. The `terraform-staging` job runs **before**
`build-images` in the same pipeline run, so the revoke and the new no-cross-project build path land
together and stay consistent within a single run.

## Consequences

**Positive:**
- **The cross-project `artifactregistry.reader` grant is gone** — the prod SA can no longer read the
  staging AR. Least-privilege win, and one fewer fragile cross-project dependency (AC #1, #2 of #397).
- No production deploy step references the staging AR; the prod AR is populated by an authenticated
  direct push from prod credentials.
- Symmetric with production-only mode (which already does a single direct build-push to the prod AR).

**Negative / trade-offs:**
- One extra `docker/build-push-action` invocation per image in staging-enabled mode. Cost is a
  cache-resolve + manifest/layer push (layers already cached `mode=max`), roughly equivalent to the
  imagetools registry-to-registry copy it replaces — CI wall-clock is approximately neutral.
- The prod build-push relies on the staging build's GHA cache export having completed. If that cache
  were ever absent, the prod build would rebuild from source rather than fail — correct, just slower.
- **The prod image is a cache-resolved rebuild, not a literal copy.** The old `imagetools create`
  produced a prod image with the **same digest** as the staging one by construction. A second
  `docker/build-push-action` resolved from the staging build's `mode=max` cache normally reproduces
  the identical digest, but it is no longer byte-identical *by construction*: on a cold cache the prod
  step rebuilds `api:<sha>` / `web:<sha>` from source and may emit a functionally-equivalent but
  digest-different image from the one the staging gate exercised. This slightly relaxes the
  "build-once / promote-everywhere, staging tests the exact prod artifact" contract that
  [ADR-028](ADR-028-web-runtime-public-config.md) restored. The residual risk is accepted: both builds
  run from the **same commit** and the **same deterministic Dockerfile**, carry the **same `<sha>`
  tag**, and the warm cache (digest-identical) is the steady-state path — a cold-cache rebuild is the
  rare exception, and the image it produces is functionally equivalent. Eliminating the standing
  cross-project IAM grant is judged the better trade than preserving a strictly byte-identical promote
  via the cross-project read.

**Resilience / rollback:**
- The prod build-push reuses the same `Wandalen/wretry.action` 3× bounded retry as the staging push
  (and as the old imagetools copy), preserving resilience to transient Artifact Registry 504s
  ([#498](https://github.com/brownm09/lifting-logbook/issues/498) /
  [#504](https://github.com/brownm09/lifting-logbook/issues/504)).
- Rollback is a PR revert, which restores **both** the imagetools copy path **and** the Terraform
  grant. The grant must be re-applied (`terraform apply` on staging) before the reverted copy path
  can read the staging AR again — a plain workflow rollback without the Terraform apply would leave
  the copy step permission-denied.

## Alternatives Considered

### Single multi-registry push (one `build-push` with both ARs' tags)
List both staging-AR and prod-AR tags on one `docker/build-push-action` invocation. **Rejected:** a
single push uses one active credential (the gcloud Docker credential helper reads one ADC), so this
needs one SA able to *write* both registries — i.e. the staging SA granted `writer` on the prod AR.
That is a *worse* cross-project grant (write, not read) than the one being removed.

### Build once with `--load`, then two manual `docker push`
Build the image into the local Docker daemon, then `docker tag` + `docker push` to each AR.
**Rejected:** avoids the second cache-resolve but drops the established `wretry` +
`docker/build-push-action` retry wrapper, hand-rolling push retries for the AR-504 class. The
cache-resolve cost the second build-push pays is negligible, so the consistency/robustness of reusing
the existing pattern wins.

## Verification

- **Terraform:** `terraform validate` passes; `terraform plan` on staging shows the **only** IAM
  change is the removal (revoke) of the `external_readers` member — no other drift.
- **Workflow:** the rewritten `build-images` steps preserve the auth-context invariant — the staging
  build-push runs under staging auth, the prod build-push runs under prod auth, and the job ends on
  prod auth (documented in the trailing comment).
- **End-to-end (post-merge):** like ADR-028, full validation is the staging-enabled deploy run on
  merge to `main`: `terraform-staging` revokes the grant, `build-images` direct-pushes both images
  to **both** ARs, and `deploy-production` pulls the prod AR with **no** cross-project access. This
  cannot be exercised from a feature branch (the deploy jobs gate on `main`).

## Addendum — 2026-07-10 (#795): same-project pull-through mirror reader

This ADR removed the module's one **cross-project** `artifactregistry.reader` grant (the prod SA
reading the staging AR). [#795](https://github.com/brownm09/lifting-logbook/issues/795) then adds the
module's first **same-project** AR reader grant, and the two do not conflict.

A `REMOTE_REPOSITORY` Docker Hub pull-through repo `${var.app_name}-dockerhub`
(`google_artifact_registry_repository.dockerhub_mirror`, `main.tf`) was added so the otel-collector
image is served from Artifact Registry rather than Docker Hub on the request path — Docker Hub's
mutable tag exposes new production instances to a rate-limit (100 pulls/6h per IP) or outage on every
cold-start / node pull ([#788](https://github.com/brownm09/lifting-logbook/issues/788)). Pulling
*through* a remote repo requires `artifactregistry.reader` **on that repo**, so
`google_artifact_registry_repository_iam_member.dockerhub_mirror_readers` grants it — scoped to the
mirror repo, inside each environment's **own** project — to the two image-pull identities: the Cloud
Run **service agent** (`serverless-robot`) and the default **Compute SA** (GKE Autopilot node pulls).

This is consistent with ADR-029's least-privilege stance: the grant is same-project (never
cross-project), repo-scoped (not project-wide), and given only to identities that pull images. The
standard `images` repo keeps relying on Google's implicit project-level reader; the grant is explicit
here because a remote repo's first pull-through is exercised only on the production/staging
`deploy.yml` run (`push: main`), which PR CI does not execute.

## References

- [Google Cloud — Artifact Registry: push and pull images](https://cloud.google.com/artifact-registry/docs/docker/pushing-and-pulling) —
  Official guidance on authenticating to and pushing images to a Docker repository; the direct
  per-registry push this ADR adopts.
- [Google Cloud — Artifact Registry access control with IAM](https://cloud.google.com/artifact-registry/docs/access-control) —
  Defines `roles/artifactregistry.reader` / `writer`; the basis for asserting the prod SA needs only
  *write* on the prod AR and no longer needs *read* on the staging AR (least privilege).
- [Docker — `docker buildx imagetools create`](https://docs.docker.com/reference/cli/docker/buildx/imagetools/create/) —
  The registry-to-registry copy command being replaced; its source read is what required the
  cross-project grant.
- [`docker/build-push-action`](https://github.com/docker/build-push-action) and
  [Docker — GitHub Actions cache backend (`type=gha`)](https://docs.docker.com/build/cache/backends/gha/) —
  The build-push action and the GHA cache (`cache-from` / `cache-to mode=max`) that make the second
  per-env push a cache-resolve rather than a rebuild.
