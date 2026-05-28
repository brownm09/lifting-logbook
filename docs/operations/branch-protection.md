# Branch protection — `main`

`main` requires all of the following GitHub Actions status checks to pass before a PR can merge without `--admin`:

| Required context | Source workflow | Job |
|---|---|---|
| `Lint & Test` | `.github/workflows/ci.yml` | `lint-test` |
| `DB Integration Tests` | `.github/workflows/ci.yml` | `db-integration` |
| `Observability Stack Smoke Test` | `.github/workflows/ci.yml` | `observability-smoke` |
| `Playwright E2E` | `.github/workflows/ci.yml` | `playwright-e2e` |
| `Staging Integration Tests` | `.github/workflows/staging.yml` | `staging-integration-tests` |

The job `name:` values match the required-check contexts character-for-character. Renaming any job is a breaking change to branch protection.

## Staging-credential dependency

Three of the five checks (`Staging Integration Tests` and the deploy chain it depends on, plus `Playwright E2E` if it inherits staging context) are gated by the staging workflow's preflight:

```yaml
# .github/workflows/staging.yml:586
if: always() && needs.preflight.outputs.should_run == 'true'
```

`should_run` is `false` when the `GCP_STAGING_WORKLOAD_IDENTITY_PROVIDER` secret is unset. In that case the job is skipped and the required check never reports — every PR will be stuck at `mergeStateStatus: BLOCKED` until the secret is restored. If staging is intentionally decommissioned, remove `Staging Integration Tests` from the required-check list at the same time.

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
