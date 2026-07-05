# ADR-030: GitHub Merge Queue Adoption

**Status:** Accepted
**Date:** 2026-07-05
**Closes:** [#673](https://github.com/brownm09/lifting-logbook/issues/673) (staged across [#694](https://github.com/brownm09/lifting-logbook/issues/694), [#695](https://github.com/brownm09/lifting-logbook/issues/695))
**Related:** [ADR-023](ADR-023-staging-integration-test-design.md) (the `Staging Integration Tests` required check this decision protects the throughput of)

---

## Context

[#673](https://github.com/brownm09/lifting-logbook/issues/673) diagnosed a live-lock during concurrent PR throughput (observed in PRs [#661](https://github.com/brownm09/lifting-logbook/pull/661) and [#664](https://github.com/brownm09/lifting-logbook/pull/664)): `staging.yml`'s `deploy-api`/`deploy-web` jobs share a *global*, not per-PR, concurrency group. GitHub Actions keeps only one pending run per concurrency group, so under sustained multi-PR throughput a newer PR's push silently cancels an older PR's queued deploy. The `staging-integration-tests` job's prerequisite check treats that cancellation as a hard failure of the required `Staging Integration Tests` check. Combined with branch protection's `strict: true` (require branches up to date — see [`branch-protection.md`](../operations/branch-protection.md)), fixing one PR's now-failed check means pushing an update, which re-enters the same contested queue — a live-lock, not just added latency.

### Options considered (from #673)

1. **GitHub merge queue** — serializes required-check re-validation at the front of one queue. Confirmed available: this repo is public, and merge queue's org-only restriction applies to private repos only.
2. **Make `Staging Integration Tests` non-required**, moving staging validation to post-merge (it already re-runs there via `deploy.yml`'s `smoke-test` job ahead of the manual-approval production gate). Lowest implementation cost, but weakens pre-merge signal.
3. **Per-PR ephemeral staging namespaces** — removes the shared mutex entirely, but multi-week scope (per-PR Cloud Run/k8s namespacing, DB-per-PR or schema-per-PR, cleanup automation) disproportionate to a solo-maintainer repo's throughput problem.
4. **Custom polling-based mutex** (e.g. `softprops/turnstyle`) instead of `concurrency:` — swaps one flakiness class for another (polling/timeout tuning) and does nothing for the branch-protection "up to date" race, which is the other half of the live-lock.

## Decision

**Adopt GitHub merge queue (option 1).** Staged across two PRs to bound the blast radius of a CI-required-check change:

- **[#694](https://github.com/brownm09/lifting-logbook/issues/694)** — additive-only: add `merge_group` triggers to `ci.yml` and `staging.yml`, and make every `github.event.pull_request.*` context reference in both files safe under `merge_group` (concurrency groups, the `build-images` fork-repo guard, image tag resolution and Docker tagging, the `dorny/paths-filter` preflight diff, and skipping the PR-comment-only `report-status` job). Zero behavior change to existing `pull_request`/`push` runs.
- **[#695](https://github.com/brownm09/lifting-logbook/issues/695)** — after #694 has run for a while and is confirmed stable: enable "Require merge queue" in live branch protection, set Build Concurrency to 1 (keeps the staging-deploy mutex uncontended even inside the queue, given the one shared staging environment), and live-validate via a real PR through the queue.

## Rationale

- **Structural fix, not a workaround.** A merge queue is the architecturally correct tool for "required check + strict up-to-date + high PR throughput" — it eliminates the up-to-date race for *all* required checks, not just staging, and removes the deploy-mutex cancellation cascade at its root (at most one queue entry re-validates at a time, so the mutex becomes uncontended rather than merely tolerated).
- **Preserves pre-merge signal**, unlike option 2 — a broken staging integration still blocks the merge rather than landing transiently on `main`.
- **Confirmed available now** at no cost — this repo's public visibility means no plan upgrade or org migration is needed, unlike a private repo would require.
- **Staging's own deploy-mutex groups (`staging-deploy-mutex-api`/`-web`) intentionally stay global and unchanged** — their purpose (serializing writes to the one shared physical staging environment) is orthogonal to which event triggered the job. The merge queue makes that mutex *uncontended in practice*, not irrelevant in principle.

## Consequences

**Positive:**
- Both the "up to date" race and the staging-mutex cancellation cascade are eliminated for merge-queue-processed PRs, without weakening the pre-merge staging check.
- The fix generalizes to any future required check, not just `Staging Integration Tests`.

**Negative / accepted:**
- **`prod-plan-pr.yml` is not migrated.** It shares the same fork-guard and concurrency-group shape as `staging.yml` but produces no required check (advisory Terraform-plan comment only). A Terraform-touching PR loses that advisory comment when processed through the queue post-#695 — a UX gap, not a safety gap.
- **Fork-PR + merge-queue interaction is assumed, not exhaustively verified against GitHub's docs.** The `build-images` fork-repo guard is skipped entirely for `merge_group` events, on the assumption that merge-queue entries are always same-repo branches. This repo has no fork-PR contribution pattern in practice, making the assumption low-risk even if it does not hold universally.
- **`merge_group.base_sha`/`.head_sha` field names were not fully doc-confirmed at implementation time** (GitHub's published docs are thin on the exact `merge_group` webhook payload shape beyond `head_sha`/`head_ref` being the documented per-entry identifiers). Every use is designed with a safe-direction fallback (falls back to "always run" or "always rebuild fresh" if the field resolves empty) so an incorrect field name degrades to a correctness/efficiency loss, never a silent skip. #695's live validation is the actual confirmation.
- A regular (non-queued) PR-preview push and a merge-queue entry can still contend for the same global deploy-mutex group — pre-existing behavior, not introduced or worsened by this change.

## Escalation trigger

Revisit if:
- This repo begins accepting fork-PR contributions — the `build-images` merge_group fork-guard carve-out needs re-verification against GitHub's actual fork+merge-queue support at that time.
- #695's live validation shows `merge_group.base_sha`/`.head_sha` do not resolve as expected — fix promptly; blast radius is bounded to reduced efficiency (always-rebuild / always-run-smoke-test), not a broken required check, per the safe-fallback design above.

## References

- [GitHub — About merge queue](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/about-merge-queue) — merge queue's purpose, prerequisites, and the org-only-for-private-repos restriction that this repo's public visibility avoids.
- [GitHub — Managing a merge queue](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue) — documents that CI workflows must add a `merge_group` trigger to run against merge-queue entries, and the Build Concurrency / Merge limits settings used in #695.
- [GitHub Actions — Events that trigger workflows § `merge_group`](https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows#merge_group) — the `checks_requested` activity type and `GITHUB_SHA`/`GITHUB_REF` semantics for merge-queue runs.
- [dorny/paths-filter — README](https://github.com/dorny/paths-filter#readme) — confirms `merge_group` support requires a real git checkout and an explicit `base` input (unlike `pull_request`, which uses the GitHub API and ignores `base`), the basis for the `preflight` job change in #694.
- [#673](https://github.com/brownm09/lifting-logbook/issues/673) — root-cause diagnosis and options-considered analysis this ADR summarizes.
