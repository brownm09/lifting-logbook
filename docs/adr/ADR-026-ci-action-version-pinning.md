# ADR-026: CI Action Version Pinning

**Status:** Accepted
**Date:** 2026-06-04
**Closes:** [#418](https://github.com/brownm09/lifting-logbook/issues/418)
**Related:** [#416](https://github.com/brownm09/lifting-logbook/pull/416) (the Node 20 deprecation-wave bumps that spun off this issue), [ADR-025](ADR-025-web-image-per-env-build.md) (the privileged `deploy.yml`/`staging.yml` workflows whose supply-chain posture this governs)

---

## Context

GitHub Actions workflows reference third-party actions by a floating major-version tag
(`actions/checkout@v5`, `docker/build-push-action@v6`, etc.). [#416](https://github.com/brownm09/lifting-logbook/pull/416)
cleared the 2026-06-16 Node 20 runtime-deprecation wave by bumping three actions to their next
majors. Two adjacent hygiene questions were deliberately left out of that tightly-scoped PR and
filed as [#418](https://github.com/brownm09/lifting-logbook/issues/418):

1. **Audit the remaining actions** for the *next* runtime-deprecation cycle, so the next wave is
   queued rather than discovered under deadline.
2. **Decide a tag-pinning posture** for the privileged workflows (`deploy.yml`, `staging.yml`)
   that authenticate to GCP via OIDC and push container images — i.e. whether to keep floating
   major tags or move to immutable commit-SHA (digest) pins.

### Audit result (item 1)

Every action not already addressed by [#416](https://github.com/brownm09/lifting-logbook/pull/416)
is on a current major whose `runs:` uses a Node runtime GitHub still ships on its runners
(`node20` or `node24` at time of writing — see the Runtime column). No action is on a
soon-to-be-deprecated runtime; **no bumps are needed this wave.** The table inventories every
action referenced across `.github/workflows/` except `actions/checkout@v5` and
`hashicorp/setup-terraform@v4` (bumped in #416); `google-github-actions/auth` — the third #416
bump — is re-listed here because it carries the OIDC credentials this ADR's supply-chain posture
is most concerned with.

| Action | Pin | Workflows | Runtime |
|---|---|---|---|
| `actions/setup-node` | `@v4` | `ci.yml`, `staging.yml` | node20 |
| `actions/cache` | `@v4` | `ci.yml` | node20 |
| `actions/upload-artifact` | `@v4` | `ci.yml`, `staging.yml`, `required-checks-drift.yml` | node20 |
| `actions/github-script` | `@v9` | `staging.yml` | node24 |
| `google-github-actions/auth` | `@v3` | `deploy.yml`, `staging.yml` | node20 |
| `google-github-actions/get-gke-credentials` | `@v2` | `deploy.yml`, `staging.yml` | node20 |
| `docker/setup-buildx-action` | `@v3` | `deploy.yml`, `staging.yml` | node20 |
| `docker/build-push-action` | `@v6` | `deploy.yml`, `staging.yml` | node20 |
| `azure/setup-helm` | `@v4` | `deploy.yml`, `staging.yml` | node20 |
| `dorny/paths-filter` | `@v3` | `staging.yml` | node20 |

`google-github-actions/setup-gcloud` is **not** used — `gcloud` is pre-installed on
`ubuntu-latest` runners and invoked directly from `run:` steps.

Note `actions/github-script@v9` already runs on `node24`, ahead of the `node20` deprecation
curve. The two third-party actions in the inventory (`azure/setup-helm`, `dorny/paths-filter`)
are covered by the same floating-tag decision below; neither holds OIDC credentials (the
supply-chain concern is concentrated in `google-github-actions/auth`, addressed by #416's bump
and re-audited here).

## Decision

**Keep floating major-version tags (`@vN`) for all actions, in every workflow — option (a).**

Re-audit action runtimes whenever GitHub announces a runner Node-runtime deprecation (the same
trigger that produced [#416](https://github.com/brownm09/lifting-logbook/pull/416)); bump in a
single tightly-scoped PR after verifying input compatibility against each target `action.yml`.

## Rationale

- **Supply-chain exposure is low for this project.** A digest pin defends against a malicious
  force-push to a major tag on the upstream action repo. The realistic blast radius here is one
  solo-maintained repository; there is no third-party fork, no untrusted PR auto-running against
  the privileged workflows (they run on push to `main` / from trusted contexts), and the OIDC
  identities are scoped per-environment. The probability × impact does not yet justify the
  maintenance tax.
- **Floating tags track security patches automatically.** Pinning to `@vN` picks up patch and
  minor releases of the action — including the action authors' own security fixes — with no
  manual intervention. Digest pins freeze that, so a digest strategy is only safe when paired
  with Dependabot to keep digests current, which is itself ongoing config to maintain.
- **Consistency with GitHub's own guidance for first-party actions.** GitHub recommends pinning
  to a full commit SHA for *third-party* actions in high-risk contexts, but treats its own
  `actions/*` (the majority of pins here) as trusted at the major-tag level.
- **No bifurcated convention.** Digest-pinning only `deploy.yml`/`staging.yml` (option b) would
  split the repo's pinning style across workflows, raising the cognitive cost of every future
  bump for a marginal risk reduction.

## Consequences

**Positive:**
- Zero new maintenance surface; no Dependabot config to own.
- Security patches in upstream actions are picked up automatically.
- One uniform pinning convention across all workflows.

**Negative / accepted risk:**
- A compromised upstream tag-move (e.g. a force-push to `actions/checkout@v5` or
  `google-github-actions/auth@v3`) would run in the privileged `deploy.yml`/`staging.yml`
  context and could attempt to exfiltrate the short-lived OIDC token during the auth step. This
  is the residual risk the decision accepts. It is bounded by per-environment workload-identity
  scoping and the short token lifetime, and is revisited at the escalation trigger below.

## Escalation trigger

Revisit and move to digest-pinning (option b for the privileged workflows, or option c
everywhere with Dependabot) if any of the following changes:

- The repo begins accepting third-party contributions that can trigger the privileged workflows.
- A real tag-move compromise is reported against any action used in `deploy.yml`/`staging.yml`.
- The GCP service accounts gain broader IAM scope such that an exfiltrated OIDC token's blast
  radius materially increases.

## References

- [GitHub — Security hardening for GitHub Actions § Using third-party actions](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions#using-third-party-actions) —
  GitHub's own guidance: pin third-party actions to a full-length commit SHA in high-risk
  contexts; first-party `actions/*` are trusted at tag level.
- [GitHub — Workflow syntax: `uses`](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_idstepsuses) —
  Defines the `@ref` pinning forms (branch, tag, SHA) and their resolution semantics.
- [GitHub Changelog — GitHub Actions: Transitioning from Node 16 to Node 20](https://github.blog/changelog/2023-09-22-github-actions-transitioning-from-node-16-to-node-20/) —
  The runtime-deprecation mechanism that drives the re-audit trigger; the same class of
  announcement produced [#416](https://github.com/brownm09/lifting-logbook/pull/416).
- [Dependabot — Keeping your actions up to date](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/keeping-your-actions-up-to-date-with-dependabot) —
  The mechanism that would be required to make a digest-pin strategy maintainable; its absence is
  part of why option (a) is chosen.
