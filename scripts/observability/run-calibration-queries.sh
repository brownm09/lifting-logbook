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

# --- Step 1: confirm http_route is the route template (low cardinality) ---
run_query "1a — distinct route labels (expect templated paths, not raw IDs)" \
  'count by (http_route) (http_server_request_duration_seconds_count)'

run_query "1b — total route cardinality (expect ~number of endpoints)" \
  'count(count by (http_route) (http_server_request_duration_seconds_count))'

run_query "1c — empty/missing-route series (small fixed set is fine)" \
  'count by (http_route) (http_server_request_duration_seconds_count{http_route=""})'

# --- Step 2: characterize traffic to choose a volume floor vs. a longer for: ---
run_query "2a — per-route avg request rate, req/s over 14d" \
  'sum by (http_route) (rate(http_server_request_duration_seconds_count[14d]))'

run_query "2b — per-route PEAK 5m request rate over 14d" \
  'max_over_time((sum by (http_route) (rate(http_server_request_duration_seconds_count[5m])))[14d:5m])'

run_query "2c — per-route 5xx count over 14d" \
  'sum by (http_route) (increase(http_server_request_duration_seconds_count{http_response_status_code=~"5.."}[14d]))'

run_query "2d — overall daily request volume" \
  'sum(increase(http_server_request_duration_seconds_count[1d]))'

run_query "2e — false-positive windows under the CURRENT rule (ratio > 5%), 14d" \
  'count_over_time(((sum by (http_route) (rate(http_server_request_duration_seconds_count{http_response_status_code=~"5.."}[5m])) / sum by (http_route) (rate(http_server_request_duration_seconds_count[5m]))) > 0.05)[14d:5m])'

run_query "2f — false-positive windows WITH a 5 req/5m floor (compare vs 2e), 14d" \
  'count_over_time(((sum by (http_route) (rate(http_server_request_duration_seconds_count{http_response_status_code=~"5.."}[5m])) / sum by (http_route) (rate(http_server_request_duration_seconds_count[5m])) > 0.05) and (sum by (http_route) (rate(http_server_request_duration_seconds_count[5m])) > 0.0167))[14d:5m])'

echo
echo "Done. Feed 1a/1b into Step 1 and the 2e-vs-2f difference into Step 3 of"
echo "docs/operations/slo.md -> 'Calibrating APIRouteHighErrorRate'."
