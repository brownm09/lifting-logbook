# Branch protection — `main`

`main` requires all of the following GitHub Actions status checks to pass before a PR can merge without `--admin`:

| Required context | Source workflow | Job |
|---|---|---|
| `Lint & Test` | `.github/workflows/ci.yml` | `lint-and-test` |
| `DB Integration Tests` | `.github/workflows/ci.yml` | `db-integration` |
| `Observability Stack Smoke Test` | `.github/workflows/ci.yml` | `observability-smoke` |
| `Playwright E2E` | `.github/workflows/ci.yml` | `e2e` |
| `Staging Integration Tests` | `.github/workflows/staging.yml` | `staging-integration-tests` |

The job `name:` values match the required-check contexts character-for-character. Renaming any job is a breaking change to branch protection.

## Source of truth

[`.github/expected-required-checks.json`](../../.github/expected-required-checks.json) is the canonical list of required contexts. The [`Required Checks Drift`](../../.github/workflows/required-checks-drift.yml) workflow runs weekly (Mondays 13:17 UTC) and on every push to `main` that touches the JSON file or the workflow itself. It fetches the live `required_status_checks` from the GitHub API, diffs it against the JSON, and:

- exits red and opens (or comments on the existing) issue labeled `required-checks-drift` when the two sets diverge;
- exits green and takes no other action otherwise.

When changing the required-check set, edit the JSON in the same PR that updates live branch protection. The table above must also be kept in sync — the workflow only enforces JSON-vs-live, not table-vs-JSON.

**Auth note.** The branch-protection read endpoint requires `Administration: read`, which the default `GITHUB_TOKEN` does not grant. The workflow uses a repo secret `BRANCH_PROTECTION_READ_TOKEN` — a fine-grained PAT scoped to this repo with `Administration: read` only. If the secret is missing or expired, the workflow falls back to `GITHUB_TOKEN`, which 403s on the protection endpoint and surfaces a loud-red failure rather than a silent pass. Rotate the PAT before its GitHub-emailed expiration notice and overwrite the secret via Settings → Secrets and variables → Actions (or `gh secret set BRANCH_PROTECTION_READ_TOKEN`).

## Staging-credential dependency

One of the five required checks — `Staging Integration Tests` — is gated by the staging workflow's preflight. The `staging-integration-tests` job's `if:` condition is:

```yaml
if: always() && needs.preflight.outputs.should_run == 'true'
```

`should_run` is `false` when the `GCP_STAGING_WORKLOAD_IDENTITY_PROVIDER` secret is unset. In that case the job is skipped and the required check never reports — every PR will be stuck at `mergeStateStatus: BLOCKED` until the secret is restored. If staging is intentionally decommissioned, remove `Staging Integration Tests` from `.github/expected-required-checks.json` and from live branch protection in the same PR.

The other four required checks (`Lint & Test`, `DB Integration Tests`, `Observability Stack Smoke Test`, `Playwright E2E`) live in `ci.yml` and have no staging-credential dependency.

## Inspecting and updating

```bash
# Inspect current required checks
gh api repos/brownm09/lifting-logbook/branches/main/protection/required_status_checks

# Update (full replacement of the contexts list)
gh api -X PATCH repos/brownm09/lifting-logbook/branches/main/protection/required_status_checks \
  -F strict=true \
  -f 'contexts[]=Lint & Test' \
  -f 'contexts[]=DB Integration Tests' \
  -f 'contexts[]=Observability Stack Smoke Test' \
  -f 'contexts[]=Playwright E2E' \
  -f 'contexts[]=Staging Integration Tests'
```

`strict=true` means PRs must be up to date with `main` before the checks count.

## Merge queue readiness

[#673](https://github.com/brownm09/lifting-logbook/issues/673) diagnosed a live-lock: concurrent PR throughput causes `staging.yml`'s deploy jobs (which share a global, not per-PR, concurrency group) to cancel each other's queued runs, which `Staging Integration Tests` then hard-fails on — compounding with `strict: true` above. The fix is GitHub's native merge queue, which serializes required-check re-validation at the front of one queue.

As of [#694](https://github.com/brownm09/lifting-logbook/issues/694), both required-check workflows (`ci.yml` and `staging.yml`) also trigger on `merge_group`, with `github.event.pull_request.*` context references made merge_group-safe throughout (concurrency groups, the fork-repo guard, image tagging, the `dorny/paths-filter` preflight diff, and skipping the PR-comment-only `report-status` job). See [ADR-030](../adr/ADR-030-github-merge-queue-adoption.md) for the full decision record.

**"Require merge queue" is NOT YET enabled in live branch protection.** This is deliberately staged: #694 is additive-only wiring, run for a while and confirmed stable before the branch-protection setting is flipped and live-validated in a follow-up ([#695](https://github.com/brownm09/lifting-logbook/issues/695)). This section will be updated once #695 lands to reflect the live "Require merge queue" + Build Concurrency setting.
