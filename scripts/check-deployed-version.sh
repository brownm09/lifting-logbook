#!/usr/bin/env bash
# check-deployed-version.sh — Reports the deployed git commit (via GET /version) for the
# api and web Cloud Run services in staging and/or production, plus `git log -1` context
# for each returned SHA (#672 / #670).
#
# Closes the gap from the 2026-07-03 incident (#670): there was no fast way to check "what
# commit is actually running right now" without a Cloud Console detour. This curls the
# live /version endpoint on each service instead. api requires a Cloud Run identity token
# (mirrors the "Smoke test Cloud Run production — /readyz" step in
# .github/workflows/deploy.yml); web is --allow-unauthenticated.
#
# Attempts all 4 checks even if one fails — aggregates failures and reports a summary at
# the end, exiting non-zero only then (mirrors deploy.yml's "Validate production auth
# secrets (pre-promote)" step rather than aborting on the first failure).
#
# Two things worth knowing before reading the output:
#   * "environment" in the JSON response is NODE_ENV, not the GCP project. Staging's Cloud
#     Run services run NODE_ENV=production (the Node convention for "optimized build"), so
#     staging's /version legitimately reports "environment":"production" — this does not
#     mean you're looking at prod. See docs/runbooks/checking-deployed-version.md.
#   * On staging specifically, the reported SHA can lag the PR's actual head commit when a
#     run reused a prior image via staging.yml's skip-build optimization (see the "Resolve
#     image tag" step comment in staging.yml, #671) — this is expected, not a broken deploy.
#
# Prereqs:
#   * gcloud CLI, authenticated, with roles/iam.serviceAccountTokenCreator on the relevant
#     CI/CD service account (needed only for the *-api checks — see --staging-service-account
#     / --prod-service-account below).
#   * git (for the `git log -1` context; degrades gracefully — not a crash — if a SHA isn't
#     resolvable in the local clone's history).
#   * node (JSON parsing — this repo's local dev convention avoids requiring jq; see CLAUDE.md).
#
# Usage:
#   bash scripts/check-deployed-version.sh [--env both|staging|production] \
#       [--staging-project-id <id>] [--prod-project-id <id>] \
#       [--staging-service-account <email>] [--prod-service-account <email>] \
#       [--region <region>]
#
# Examples:
#   bash scripts/check-deployed-version.sh                       # both environments
#   bash scripts/check-deployed-version.sh --env staging          # staging only

set -uo pipefail

ENVS="both"
STAGING_PROJECT_ID="lifting-logbook-staging"
PROD_PROJECT_ID="lifting-logbook-prod"
STAGING_SERVICE_ACCOUNT=""
PROD_SERVICE_ACCOUNT=""
REGION="us-central1"

usage() {
  echo "Usage: $0 [--env both|staging|production]" >&2
  echo "          [--staging-project-id <id>] [--prod-project-id <id>]" >&2
  echo "          [--staging-service-account <email>] [--prod-service-account <email>]" >&2
  echo "          [--region <region>]" >&2
  exit "${1:-0}"
}

while [ $# -gt 0 ]; do
  case "$1" in
    --env) ENVS="$2"; shift 2 ;;
    --staging-project-id) STAGING_PROJECT_ID="$2"; shift 2 ;;
    --prod-project-id) PROD_PROJECT_ID="$2"; shift 2 ;;
    --staging-service-account) STAGING_SERVICE_ACCOUNT="$2"; shift 2 ;;
    --prod-service-account) PROD_SERVICE_ACCOUNT="$2"; shift 2 ;;
    --region) REGION="$2"; shift 2 ;;
    -h|--help) usage 0 ;;
    *) echo "Unknown argument: $1" >&2; usage 1 ;;
  esac
done

case "$ENVS" in
  both|staging|production) ;;
  *) echo "ERROR: --env must be both|staging|production (got '$ENVS')" >&2; exit 1 ;;
esac

command -v gcloud >/dev/null 2>&1 || { echo "ERROR: gcloud CLI not found on PATH." >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo "ERROR: node not found on PATH (needed for JSON parsing)." >&2; exit 1; }

FAILURES=0

# Parses a /version JSON body on stdin; prints "gitSha<TAB>environment" and returns 0, or
# returns 1 on invalid JSON / missing fields. Avoids a hard dependency on jq (not guaranteed
# installed locally — see CLAUDE.md), matching scripts/smoke-test-observability.sh's
# node-based JSON handling.
parse_version_json() {
  node -e '
    let d = "";
    process.stdin.on("data", c => d += c);
    process.stdin.on("end", () => {
      try {
        const j = JSON.parse(d);
        if (typeof j.gitSha !== "string" || typeof j.environment !== "string") {
          process.exit(1);
        }
        process.stdout.write(j.gitSha + "\t" + j.environment);
      } catch (e) {
        process.exit(1);
      }
    });
  '
}

# Maps the --env label to the abbreviated infix Cloud Run service names actually use
# (lifting-logbook-stg-*, lifting-logbook-prod-* — see .github/workflows/deploy.yml's
# `gcloud run deploy` steps). Kept as a separate mapping from the "staging"/"production"
# labels used elsewhere in this script's flags/output, which read better for a human.
service_env_infix() {
  case "$1" in
    staging) echo "stg" ;;
    production) echo "prod" ;;
  esac
}

# Prints `git log -1` context for a SHA, or a clear degraded-not-crashed note if the SHA
# isn't resolvable in this local clone's history (e.g. a shallow clone, or truly unknown).
print_commit_context() {
  local sha="$1"
  if [ "$sha" = "unknown" ]; then
    echo "    (GIT_SHA was not baked into this image — cannot look up commit context)"
    return
  fi
  if git cat-file -e "${sha}^{commit}" 2>/dev/null; then
    git log -1 --format='    %h  %s  (%an, %ar)' "$sha"
  else
    echo "    (commit ${sha:0:7} not found in this local clone's history — try 'git fetch origin' or view it directly: https://github.com/brownm09/lifting-logbook/commit/${sha})"
  fi
}

# Checks a --allow-unauthenticated web service. No identity token needed.
#   $1 = env label ("staging"|"production"), $2 = GCP project id
check_web() {
  local env="$1" project="$2"
  local service="lifting-logbook-$(service_env_infix "$env")-web"
  echo "==> ${env} web (${service})"

  local url
  url=$(gcloud run services describe "$service" --project="$project" --region="$REGION" --format='value(status.url)')
  if [ -z "$url" ]; then
    echo "    FAIL: could not resolve service URL (see gcloud error above, if any)" >&2
    FAILURES=$((FAILURES + 1))
    echo
    return
  fi
  url="${url%/}"

  local status
  status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "${url}/version" || echo "000")
  if [ "$status" != "200" ]; then
    echo "    FAIL: GET ${url}/version returned HTTP ${status} (expected 200)" >&2
    FAILURES=$((FAILURES + 1))
    echo
    return
  fi

  local body parsed
  body=$(curl -s --max-time 10 "${url}/version")
  if ! parsed=$(printf '%s' "$body" | parse_version_json); then
    echo "    FAIL: /version returned malformed JSON: ${body}" >&2
    FAILURES=$((FAILURES + 1))
    echo
    return
  fi

  local sha="${parsed%%$'\t'*}" nodeenv="${parsed##*$'\t'}"
  echo "    url:         ${url}"
  echo "    gitSha:      ${sha}"
  echo "    environment: ${nodeenv}  (NODE_ENV — not the GCP project; staging runs NODE_ENV=production by convention)"
  print_commit_context "$sha"
  echo
}

# Checks a --no-allow-unauthenticated api service. Mints a Cloud Run identity token via
# impersonation (same pattern as deploy.yml's prod /readyz smoke test) and never echoes,
# logs, or URL-embeds it — only ever passed via the Authorization header.
#   $1 = env label, $2 = GCP project id, $3 = service account email to impersonate
check_api() {
  local env="$1" project="$2" service_account="$3"
  local service="lifting-logbook-$(service_env_infix "$env")-api"
  echo "==> ${env} api (${service})"

  if [ -z "$service_account" ]; then
    echo "    FAIL: no service account provided (--${env}-service-account) — cannot mint a Cloud Run identity token" >&2
    FAILURES=$((FAILURES + 1))
    echo
    return
  fi

  local url
  url=$(gcloud run services describe "$service" --project="$project" --region="$REGION" --format='value(status.url)')
  if [ -z "$url" ]; then
    echo "    FAIL: could not resolve service URL (see gcloud error above, if any)" >&2
    FAILURES=$((FAILURES + 1))
    echo
    return
  fi
  url="${url%/}"

  local id_token
  id_token=$(gcloud auth print-identity-token \
    --impersonate-service-account="$service_account" \
    --audiences="$url" --include-email)
  if [ -z "$id_token" ]; then
    echo "    FAIL: could not mint a Cloud Run identity token impersonating ${service_account} (see gcloud error above, if any — check you have roles/iam.serviceAccountTokenCreator on it)" >&2
    FAILURES=$((FAILURES + 1))
    echo
    return
  fi

  local status
  status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -H "Authorization: Bearer ${id_token}" "${url}/version" || echo "000")
  if [ "$status" != "200" ]; then
    echo "    FAIL: GET ${url}/version returned HTTP ${status} (expected 200)" >&2
    FAILURES=$((FAILURES + 1))
    unset id_token
    echo
    return
  fi

  local body parsed
  body=$(curl -s --max-time 10 -H "Authorization: Bearer ${id_token}" "${url}/version")
  unset id_token

  if ! parsed=$(printf '%s' "$body" | parse_version_json); then
    echo "    FAIL: /version returned malformed JSON: ${body}" >&2
    FAILURES=$((FAILURES + 1))
    echo
    return
  fi

  local sha="${parsed%%$'\t'*}" nodeenv="${parsed##*$'\t'}"
  echo "    url:         ${url}"
  echo "    gitSha:      ${sha}"
  echo "    environment: ${nodeenv}  (NODE_ENV — not the GCP project; staging runs NODE_ENV=production by convention)"
  print_commit_context "$sha"
  echo
}

if [ "$ENVS" = "both" ] || [ "$ENVS" = "staging" ]; then
  check_web staging "$STAGING_PROJECT_ID"
  check_api staging "$STAGING_PROJECT_ID" "$STAGING_SERVICE_ACCOUNT"
fi

if [ "$ENVS" = "both" ] || [ "$ENVS" = "production" ]; then
  check_web production "$PROD_PROJECT_ID"
  check_api production "$PROD_PROJECT_ID" "$PROD_SERVICE_ACCOUNT"
fi

if [ "$FAILURES" -eq 0 ]; then
  echo "All checks passed."
  exit 0
else
  echo "FAILED: ${FAILURES} check(s) did not succeed — see above." >&2
  exit 1
fi
