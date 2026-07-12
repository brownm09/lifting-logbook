#!/usr/bin/env bash
# tempo-query-env.sh — load and export Grafana Cloud Tempo *read* query credentials.
#
# Purpose:   Exports TEMPO_ADDRESS / TEMPO_API_USER / TEMPO_API_KEY (and optional
#            TEMPO_TENANT_ID) into the CURRENT shell so tempo-query.sh can run
#            read-only TraceQL queries against staging (or prod) Grafana Cloud Tempo.
#            This lets span-tag validations — e.g. #809's `client.origin.check`
#            same-origin guard — run autonomously instead of a human hand-running
#            TraceQL in Grafana Explore. Mirrors mimir-query-env.sh. Tracked in #829.
#
# Usage:     source scripts/observability/tempo-query-env.sh              # staging (default)
#            TEMPO_TARGET=prod source scripts/observability/tempo-query-env.sh
#            It MUST be sourced (not executed) or the exports do not survive.
#
# Target:    TEMPO_TARGET selects which credential set to export: `staging` (default)
#            or `prod`. The credentials file provides TEMPO_<TARGET>_* variables; this
#            script maps the selected set onto the canonical TEMPO_* names above.
#
# Credentials: copy `.tempo-credentials.example` -> `.tempo-credentials` (gitignored),
#            fill in the values from the Grafana Cloud portal, then source this script.
#            The token must be scoped `traces:read` (read-only).
#            Escape hatch: if TEMPO_ADDRESS / TEMPO_API_USER / TEMPO_API_KEY are already
#            all set in the environment, they are used as-is and the target mapping is
#            skipped (export them by hand and skip the file).
#
# Prereqs:   none (pure bash). The runner tempo-query.sh needs curl + node.

# Refuse to run if executed rather than sourced (exports would be thrown away).
if ! (return 0 2>/dev/null); then
  echo "ERROR: this script must be sourced, not executed:" >&2
  echo "  source scripts/observability/tempo-query-env.sh" >&2
  exit 1
fi

_tqe_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
_tqe_creds="$_tqe_dir/.tempo-credentials"

# Target: staging (default) | prod.
_tqe_target="${TEMPO_TARGET:-staging}"
case "$_tqe_target" in
  staging|prod) ;;
  *)
    echo "ERROR: TEMPO_TARGET must be 'staging' or 'prod' (got '$_tqe_target')." >&2
    unset _tqe_dir _tqe_creds _tqe_target
    return 1 ;;
esac

# Load the gitignored credentials file if present. It sets TEMPO_<TARGET>_* (and may
# also set the canonical TEMPO_* names directly).
if [ -f "$_tqe_creds" ]; then
  # shellcheck source=/dev/null
  . "$_tqe_creds"
fi

# Resolve the selected target's credential set. The tenant is resolved here (not only
# inside the escape-hatch gate below) so a hand-exported canonical trio can still pick up
# a self-hosted X-Scope-OrgID from the credentials file.
case "$_tqe_target" in
  staging)
    _tqe_addr="${TEMPO_STAGING_ADDRESS:-}"; _tqe_user="${TEMPO_STAGING_API_USER:-}"
    _tqe_key="${TEMPO_STAGING_API_KEY:-}";  _tqe_tenant="${TEMPO_STAGING_TENANT_ID:-}"
    ;;
  prod)
    _tqe_addr="${TEMPO_PROD_ADDRESS:-}"; _tqe_user="${TEMPO_PROD_API_USER:-}"
    _tqe_key="${TEMPO_PROD_API_KEY:-}";  _tqe_tenant="${TEMPO_PROD_TENANT_ID:-}"
    ;;
esac

# An explicitly-requested TEMPO_TARGET always wins: derive the canonical vars from the
# target set even when canonical TEMPO_* are already exported (e.g. left over from a prior
# `source` for a different target — otherwise the readiness echo would say [prod] while the
# vars still point at staging). The hand-export escape hatch (keep a fully pre-set canonical
# trio) applies only when the caller did NOT request a target explicitly.
if [ -n "${TEMPO_TARGET:-}" ] || [ -z "${TEMPO_ADDRESS:-}" ] || [ -z "${TEMPO_API_USER:-}" ] || [ -z "${TEMPO_API_KEY:-}" ]; then
  TEMPO_ADDRESS="$_tqe_addr"; TEMPO_API_USER="$_tqe_user"; TEMPO_API_KEY="$_tqe_key"
  TEMPO_TENANT_ID="$_tqe_tenant"
else
  # No explicit target + a full canonical trio already exported by hand: keep it, but
  # still honor a file-provided tenant when the caller didn't set one.
  TEMPO_TENANT_ID="${TEMPO_TENANT_ID:-$_tqe_tenant}"
fi
unset _tqe_addr _tqe_user _tqe_key _tqe_tenant

_tqe_missing=()
[ -n "${TEMPO_ADDRESS:-}" ]  || _tqe_missing+=("TEMPO_ADDRESS")
[ -n "${TEMPO_API_USER:-}" ] || _tqe_missing+=("TEMPO_API_USER")
[ -n "${TEMPO_API_KEY:-}" ]  || _tqe_missing+=("TEMPO_API_KEY")

if [ "${#_tqe_missing[@]}" -gt 0 ]; then
  echo "ERROR: missing required variable(s) for target '$_tqe_target': ${_tqe_missing[*]}" >&2
  echo "Provide them by copying the template and filling in values from the Grafana Cloud portal:" >&2
  echo "  cp $_tqe_dir/.tempo-credentials.example $_tqe_creds" >&2
  echo "Then edit $_tqe_creds and re-run: source ${BASH_SOURCE[0]}" >&2
  echo "(Grafana Cloud portal -> your stack -> Tempo: the query URL + numeric user ID," >&2
  echo " plus an Access Policy token with the traces:read scope.)" >&2
  unset _tqe_dir _tqe_creds _tqe_target _tqe_missing
  return 1
fi

export TEMPO_ADDRESS TEMPO_API_USER TEMPO_API_KEY
[ -n "${TEMPO_TENANT_ID:-}" ] && export TEMPO_TENANT_ID

echo "Tempo query env ready [$_tqe_target]: TEMPO_ADDRESS=$TEMPO_ADDRESS (user=$TEMPO_API_USER, key=***)"
unset _tqe_dir _tqe_creds _tqe_target _tqe_missing
return 0
