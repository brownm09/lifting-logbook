<#
.SYNOPSIS
  One-time interactive setup for Grafana Cloud Mimir query credentials (#468).

.DESCRIPTION
  Prompts for MIMIR_ADDRESS / MIMIR_API_USER / MIMIR_API_KEY (and optional
  MIMIR_QUERY_URL / MIMIR_TENANT_ID) and persists them to your *user* environment
  permanently via [Environment]::SetEnvironmentVariable(..., 'User'). No admin
  rights are needed and no new window is spawned. New terminals inherit the values;
  this session is updated in place too, so you can run the query script immediately.

  These are the same variable names mimirtool and run-calibration-queries.(ps1|sh)
  read, so this one setup serves all of them.

.NOTES
  Run once:
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts/observability/mimir-setup.ps1

  SECURITY: the token is stored in plaintext in your user environment
  (registry HKCU\Environment), readable by your own processes. This is the
  trade-off for "persist permanently". To remove the values later:
    'MIMIR_ADDRESS','MIMIR_API_USER','MIMIR_API_KEY','MIMIR_QUERY_URL','MIMIR_TENANT_ID' |
      ForEach-Object { [Environment]::SetEnvironmentVariable($_, $null, 'User') }
#>

$ErrorActionPreference = 'Stop'

function Set-UserEnv {
  param([string]$Name, [string]$Value)
  [Environment]::SetEnvironmentVariable($Name, $Value, 'User')  # permanent (new processes)
  Set-Item -Path "Env:$Name" -Value $Value                      # this session too
}

function Read-WithDefault {
  param([string]$Prompt, [string]$Current)
  if ($Current) { $shown = "$Prompt [$Current]" } else { $shown = $Prompt }
  $answer = Read-Host $shown
  if (-not $answer -and $Current) { return $Current }
  return $answer
}

Write-Host 'Grafana Cloud Mimir - one-time credential setup' -ForegroundColor Cyan
Write-Host 'Find these in the Grafana Cloud portal -> your stack -> Prometheus.'
Write-Host ''

$addr = Read-WithDefault 'MIMIR_ADDRESS (Prometheus query/remote-write URL base)' ([Environment]::GetEnvironmentVariable('MIMIR_ADDRESS','User'))
$user = Read-WithDefault 'MIMIR_API_USER (numeric instance / user ID)'             ([Environment]::GetEnvironmentVariable('MIMIR_API_USER','User'))

$keySec = Read-Host 'MIMIR_API_KEY (Access Policy token, metrics:read) - input hidden' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($keySec)
try   { $key = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }

# Optional. Single-quoted prompt so ${MIMIR_ADDRESS} is shown literally, not expanded.
$queryUrl = Read-Host 'MIMIR_QUERY_URL (optional - leave blank unless ${MIMIR_ADDRESS}/api/v1/query is wrong for your stack)'
$tenant   = Read-Host 'MIMIR_TENANT_ID (optional - self-hosted Mimir only; blank for Grafana Cloud)'

if (-not $addr -or -not $user -or -not $key) {
  Write-Error 'MIMIR_ADDRESS, MIMIR_API_USER and MIMIR_API_KEY are all required. Nothing saved.'
  exit 1
}

Set-UserEnv 'MIMIR_ADDRESS'  $addr
Set-UserEnv 'MIMIR_API_USER' $user
Set-UserEnv 'MIMIR_API_KEY'  $key
if ($queryUrl) { Set-UserEnv 'MIMIR_QUERY_URL' $queryUrl }
if ($tenant)   { Set-UserEnv 'MIMIR_TENANT_ID' $tenant }

Write-Host ''
Write-Host 'Saved to your user environment (permanent):' -ForegroundColor Green
Write-Host "  MIMIR_ADDRESS  = $addr"
Write-Host "  MIMIR_API_USER = $user"
Write-Host '  MIMIR_API_KEY  = *** (hidden)'
if ($queryUrl) { Write-Host "  MIMIR_QUERY_URL = $queryUrl" }
if ($tenant)   { Write-Host "  MIMIR_TENANT_ID = $tenant" }
Write-Host ''
Write-Host 'This PowerShell session already has them. Other open terminals (incl. Git Bash)'
Write-Host 'must be reopened to inherit the new values.'
Write-Host ''
Write-Host 'Next: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/observability/run-calibration-queries.ps1' -ForegroundColor Cyan
