#!/usr/bin/env bash
# run-calibration-queries.sh — run the APIRouteHighErrorRate calibration queries
# (#468) against Grafana Cloud Mimir and print the results.
#
# Purpose:   Executes calibration steps 1a-1c (label-shape check) and 2a-2f
#            (traffic characterization + false-positive estimate) documented in
#            docs/operations/slo.md -> "Calibrating APIRouteHighErrorRate", so the
#            operator can fill in Step 3's decision matrix without hand-running
#            each query in Grafana Explore.
#
# Usage:     scripts/observability/run-calibration-queries.sh
#            Credentials come from scripts/observability/mimir-query-env.sh, which
#            this script sources (see that file / .mimir-credentials.example).
#
# Prereqs:   bash, curl, node. A Grafana Cloud Mimir Access Policy token with the
#            metrics:read scope. The observability stack must have been emitting
#            metrics long enough for the [14d] windows to be meaningful.
#
# Notes:     Heavy [14d:5m] subqueries (2b/2e/2f) can hit Grafana Cloud per-query
#            limits. If they error, narrow the range / coarsen the step per the
#            fallback note in slo.md, or run those few in Grafana Explore directly.
#
# Queries:   read from calibration-queries.tsv (the single executable copy, shared
#            with run-calibration-queries.ps1). The annotated human reference lives in
#            docs/operations/slo.md -> "Calibrating APIRouteHighErrorRate"; keep the two
#            in sync when the rule's metric/label names or thresholds change.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load + validate credentials (exports MIMIR_ADDRESS / MIMIR_API_USER / MIMIR_API_KEY).
# shellcheck source=scripts/observability/mimir-query-env.sh
if ! source "$SCRIPT_DIR/mimir-query-env.sh"; then
  exit 1
fi

for bin in curl node; do
  command -v "$bin" >/dev/null 2>&1 || { echo "ERROR: '$bin' not found on PATH." >&2; exit 1; }
done

QUERY_URL="${MIMIR_QUERY_URL:-${MIMIR_ADDRESS%/}/api/v1/query}"
echo "Query endpoint: $QUERY_URL"
echo "(If queries return 404 / wrong path, set MIMIR_QUERY_URL to your stack's"
echo " Prometheus query URL with /api/v1/query appended, then re-run.)"

run_query() {
  local label="$1"
  local query="$2"
  echo
  echo "=== $label ==="
  local curl_args=(-sS -G -u "$MIMIR_API_USER:$MIMIR_API_KEY")
  [ -n "${MIMIR_TENANT_ID:-}" ] && curl_args+=(-H "X-Scope-OrgID: $MIMIR_TENANT_ID")
  if ! curl "${curl_args[@]}" "$QUERY_URL" --data-urlencode "query=$query" \
       | node "$SCRIPT_DIR/format-promql-result.js"; then
    echo "  (query failed — check the endpoint and credentials reported above)" >&2
  fi
}

QUERIES_TSV="$SCRIPT_DIR/calibration-queries.tsv"
[ -f "$QUERIES_TSV" ] || { echo "ERROR: $QUERIES_TSV not found." >&2; exit 1; }

# label<TAB>query, one per line; '#' / blank lines are comments.
while IFS=$'\t' read -r label query; do
  label="${label%$'\r'}"; query="${query%$'\r'}"   # tolerate CRLF working copies (autocrlf)
  case "$label" in ''|\#*) continue ;; esac
  [ -n "$query" ] || continue
  run_query "$label" "$query"
done < "$QUERIES_TSV"

echo
echo "Done. Feed 1a/1b into Step 1 and the 2e-vs-2f difference into Step 3 of"
echo "docs/operations/slo.md -> 'Calibrating APIRouteHighErrorRate'."
