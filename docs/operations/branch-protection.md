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
