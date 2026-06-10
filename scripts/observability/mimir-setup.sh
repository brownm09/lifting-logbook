#!/usr/bin/env bash
# mimir-setup.sh — one-time interactive setup for Grafana Cloud Mimir query creds (bash).
#
# Purpose:   The bash counterpart of mimir-setup.ps1. Prompts for MIMIR_ADDRESS /
#            MIMIR_API_USER / MIMIR_API_KEY (token input hidden) plus optional
#            MIMIR_QUERY_URL / MIMIR_TENANT_ID, then persists them to ~/.bashrc so every
#            new Git Bash shell exports them. When SOURCED, also exports into the current
#            shell so you can run the queries immediately without reopening.
#
# Usage:     # recommended — updates the current shell too:
#            source scripts/observability/mimir-setup.sh
#
#            # or run it — persists for NEW shells; for the current one, then do:
#            scripts/observability/mimir-setup.sh && source ~/.bashrc
#
#            Afterwards: scripts/observability/run-calibration-queries.sh
#
# SECURITY:  the values (including the token) are written in plaintext to ~/.bashrc —
#            the trade-off for "persist permanently". Remove them later with:
#            sed -i '/# >>> mimir-query-env >>>/,/# <<< mimir-query-env <<</d' ~/.bashrc

# NOTE: no `set -e` — this script is meant to be sourced, where `set -e` would leak
# into and could kill the user's interactive shell.

_mset_sourced=0
(return 0 2>/dev/null) && _mset_sourced=1

_mset_fail() { if [ "$_mset_sourced" = 1 ]; then return "$1"; else exit "$1"; fi; }

_mset_bashrc="${HOME}/.bashrc"
_mset_begin="# >>> mimir-query-env >>>"
_mset_end="# <<< mimir-query-env <<<"

# Prompt, offering the current value (if any) as the default.
_mset_ask() {
  local prompt="$1" current="$2" ans
  if [ -n "$current" ]; then
    read -r -p "$prompt [$current]: " ans
    [ -z "$ans" ] && ans="$current"
  else
    read -r -p "$prompt: " ans
  fi
  printf '%s' "$ans"
}

echo "Grafana Cloud Mimir — one-time credential setup (bash)"
echo "Find these in the Grafana Cloud portal -> your stack -> Prometheus."
echo

_mset_addr="$(_mset_ask 'MIMIR_ADDRESS (Prometheus query/remote-write URL base)' "${MIMIR_ADDRESS:-}")"
_mset_user="$(_mset_ask 'MIMIR_API_USER (numeric instance / user ID)' "${MIMIR_API_USER:-}")"
read -r -s -p "MIMIR_API_KEY (Access Policy token, metrics:read) — input hidden: " _mset_key
echo
_mset_qurl="$(_mset_ask 'MIMIR_QUERY_URL (optional — blank unless ${MIMIR_ADDRESS}/api/v1/query is wrong)' "${MIMIR_QUERY_URL:-}")"
_mset_tenant="$(_mset_ask 'MIMIR_TENANT_ID (optional — self-hosted Mimir only; blank for Grafana Cloud)' "${MIMIR_TENANT_ID:-}")"

if [ -z "$_mset_addr" ] || [ -z "$_mset_user" ] || [ -z "$_mset_key" ]; then
  echo "ERROR: MIMIR_ADDRESS, MIMIR_API_USER and MIMIR_API_KEY are all required. Nothing saved." >&2
  unset _mset_addr _mset_user _mset_key _mset_qurl _mset_tenant
  _mset_fail 1
else

touch "$_mset_bashrc"

# Drop any previous managed block (exact-line match — no regex escaping headaches).
if grep -qF "$_mset_begin" "$_mset_bashrc"; then
  awk -v b="$_mset_begin" -v e="$_mset_end" '
    $0==b {skip=1; next}
    skip && $0==e {skip=0; next}
    !skip {print}
  ' "$_mset_bashrc" > "$_mset_bashrc.mset.tmp" && mv "$_mset_bashrc.mset.tmp" "$_mset_bashrc"
fi

# Append a fresh block. %q makes each value safe to re-source verbatim.
{
  echo ""
  echo "$_mset_begin"
  echo "# Written by scripts/observability/mimir-setup.sh — do not edit by hand."
  printf 'export MIMIR_ADDRESS=%q\n' "$_mset_addr"
  printf 'export MIMIR_API_USER=%q\n' "$_mset_user"
  printf 'export MIMIR_API_KEY=%q\n' "$_mset_key"
  [ -n "$_mset_qurl" ]   && printf 'export MIMIR_QUERY_URL=%q\n' "$_mset_qurl"
  [ -n "$_mset_tenant" ] && printf 'export MIMIR_TENANT_ID=%q\n' "$_mset_tenant"
  echo "$_mset_end"
} >> "$_mset_bashrc"

# Export into the current shell too (effective immediately when sourced).
export MIMIR_ADDRESS="$_mset_addr"
export MIMIR_API_USER="$_mset_user"
export MIMIR_API_KEY="$_mset_key"
[ -n "$_mset_qurl" ]   && export MIMIR_QUERY_URL="$_mset_qurl"
[ -n "$_mset_tenant" ] && export MIMIR_TENANT_ID="$_mset_tenant"

echo
echo "Saved to $_mset_bashrc (permanent for new Git Bash shells):"
echo "  MIMIR_ADDRESS  = $_mset_addr"
echo "  MIMIR_API_USER = $_mset_user"
echo "  MIMIR_API_KEY  = *** (hidden)"
[ -n "$_mset_qurl" ]   && echo "  MIMIR_QUERY_URL = $_mset_qurl"
[ -n "$_mset_tenant" ] && echo "  MIMIR_TENANT_ID = $_mset_tenant"
echo
if [ "$_mset_sourced" = 1 ]; then
  echo "This shell now has them exported; new shells inherit them from ~/.bashrc."
else
  echo "NOTE: run in a subshell — this shell does not have them yet. Open a new Git Bash,"
  echo "or run:  source ~/.bashrc"
fi
echo
echo "Next: scripts/observability/run-calibration-queries.sh"

fi

unset _mset_sourced _mset_bashrc _mset_begin _mset_end _mset_addr _mset_user _mset_key _mset_qurl _mset_tenant
unset -f _mset_ask _mset_fail 2>/dev/null
