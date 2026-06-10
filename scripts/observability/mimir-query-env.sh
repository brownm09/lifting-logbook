#!/usr/bin/env bash
# mimir-query-env.sh — load and export Grafana Cloud Mimir query credentials.
#
# Purpose:   Exports MIMIR_ADDRESS / MIMIR_API_USER / MIMIR_API_KEY (and optional
#            MIMIR_QUERY_URL / MIMIR_TENANT_ID) into the CURRENT shell so the
#            APIRouteHighErrorRate calibration queries (#468) can be run against
#            production Grafana Cloud Mimir. These are the same variable names the
#            `mimirtool rules load` step in docs/operations/slo.md already uses, so
#            one credentials file serves both.
#
# Usage:     source scripts/observability/mimir-query-env.sh
#            It MUST be sourced (not executed) or the exports do not survive.
#
# Credentials: copy `.mimir-credentials.example` -> `.mimir-credentials` (gitignored),
#            fill in the values from the Grafana Cloud portal, then source this script.
#            Variables already present in the environment are respected and NOT
#            overwritten — you can also export them by hand and skip the file.
#
# Prereqs:   none (pure bash). The runner run-calibration-queries.sh needs curl + node.

# Refuse to run if executed rather than sourced (exports would be thrown away).
if ! (return 0 2>/dev/null); then
  echo "ERROR: this script must be sourced, not executed:" >&2
  echo "  source scripts/observability/mimir-query-env.sh" >&2
  exit 1
fi

_mqe_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
_mqe_creds="$_mqe_dir/.mimir-credentials"

# Load the gitignored credentials file if present (env vars set by hand win — we
# only source it; it uses `export VAR=...` lines, so pre-set values are simply
# re-assigned. To pin a value, set it after sourcing).
if [ -f "$_mqe_creds" ]; then
  # shellcheck source=/dev/null
  . "$_mqe_creds"
fi

_mqe_missing=()
[ -n "${MIMIR_ADDRESS:-}" ]  || _mqe_missing+=("MIMIR_ADDRESS")
[ -n "${MIMIR_API_USER:-}" ] || _mqe_missing+=("MIMIR_API_USER")
[ -n "${MIMIR_API_KEY:-}" ]  || _mqe_missing+=("MIMIR_API_KEY")

if [ "${#_mqe_missing[@]}" -gt 0 ]; then
  echo "ERROR: missing required variable(s): ${_mqe_missing[*]}" >&2
  echo "Provide them by copying the template and filling in values from the Grafana Cloud portal:" >&2
  echo "  cp $_mqe_dir/.mimir-credentials.example $_mqe_creds" >&2
  echo "Then edit $_mqe_creds and re-run: source ${BASH_SOURCE[0]}" >&2
  echo "(Grafana Cloud portal -> your stack -> Prometheus: the query URL + numeric user ID," >&2
  echo " plus an Access Policy token with the metrics:read scope.)" >&2
  unset _mqe_dir _mqe_creds _mqe_missing
  return 1
fi

export MIMIR_ADDRESS MIMIR_API_USER MIMIR_API_KEY
[ -n "${MIMIR_QUERY_URL:-}" ] && export MIMIR_QUERY_URL
[ -n "${MIMIR_TENANT_ID:-}" ] && export MIMIR_TENANT_ID

echo "Mimir query env ready: MIMIR_ADDRESS=$MIMIR_ADDRESS (user=$MIMIR_API_USER, key=***)"
unset _mqe_dir _mqe_creds _mqe_missing
return 0
