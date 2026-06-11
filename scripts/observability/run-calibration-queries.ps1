<#
.SYNOPSIS
  Run the #468 APIRouteHighErrorRate calibration queries against Grafana Cloud Mimir.

.DESCRIPTION
  Native PowerShell runner — no curl / node / jq required. Reads credentials from the
  environment (set once with mimir-setup.ps1), reads the 1a-2f queries from
  calibration-queries.tsv (the shared executable copy, also used by the .sh runner),
  POSTs each to the Mimir Prometheus query API, and prints a sorted route -> value
  summary. Each query runs independently; a single failure does not abort the rest.

.NOTES
  Run:
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts/observability/run-calibration-queries.ps1

  Heavy [14d:5m] subqueries (2b/2e/2f) can hit Grafana Cloud per-query limits. If one
  errors, narrow the range / coarsen the step per the fallback note in
  docs/operations/slo.md, or run those few in Grafana Explore directly.
#>

$ErrorActionPreference = 'Stop'

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$tsv  = Join-Path $here 'calibration-queries.tsv'

$addr = $env:MIMIR_ADDRESS
$user = $env:MIMIR_API_USER
$key  = $env:MIMIR_API_KEY
if (-not $addr -or -not $user -or -not $key) {
  Write-Error 'MIMIR_ADDRESS / MIMIR_API_USER / MIMIR_API_KEY not set. Run mimir-setup.ps1 first, then reopen this terminal.'
  exit 1
}
if (-not (Test-Path -LiteralPath $tsv)) {
  Write-Error "Query file not found: $tsv"
  exit 1
}

if ($env:MIMIR_QUERY_URL) { $queryUrl = $env:MIMIR_QUERY_URL }
else { $queryUrl = $addr.TrimEnd('/') + '/api/v1/query' }

$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("${user}:${key}"))
$headers = @{ Authorization = "Basic $b64" }
if ($env:MIMIR_TENANT_ID) { $headers['X-Scope-OrgID'] = $env:MIMIR_TENANT_ID }

Write-Host "Query endpoint: $queryUrl"
Write-Host '(If queries 404, set MIMIR_QUERY_URL with mimir-setup.ps1 and reopen the terminal.)'

function Format-Result {
  param($resp)
  if ($resp.status -ne 'success') {
    Write-Host "  ERROR: status=$($resp.status) $($resp.errorType) $($resp.error)" -ForegroundColor Yellow
    return
  }
  $data = $resp.data
  if ($data.resultType -eq 'scalar') {
    Write-Host "  scalar: $($data.result[1])"
    return
  }
  $rows = @($data.result)
  if ($rows.Count -eq 0) { Write-Host '  (no series returned)'; return }

  $fmt = foreach ($s in $rows) {
    $names = @($s.metric.PSObject.Properties.Name)
    if ($names -contains 'http_route') {
      if ($s.metric.http_route -eq '') { $route = '(empty http_route)' } else { $route = $s.metric.http_route }
    } elseif ($names.Count -gt 0) {
      $route = ($s.metric | ConvertTo-Json -Compress)
    } else {
      $route = '(no labels)'
    }
    [pscustomobject]@{ Route = $route; Value = $s.value[1] }
  }
  $fmt = @($fmt | Sort-Object Route)
  $w = ($fmt | ForEach-Object { $_.Route.Length } | Measure-Object -Maximum).Maximum
  if ($w -gt 60) { $w = 60 }
  foreach ($r in $fmt) { Write-Host ("  {0}  {1}" -f $r.Route.PadRight($w), $r.Value) }
  Write-Host "  ($($fmt.Count) series)"
}

foreach ($line in Get-Content -LiteralPath $tsv) {
  if (-not $line -or $line.TrimStart().StartsWith('#')) { continue }
  $parts = $line -split "`t", 2
  if ($parts.Count -lt 2 -or -not $parts[1]) { continue }
  $label = $parts[0]
  $query = $parts[1]
  Write-Host ''
  Write-Host "=== $label ===" -ForegroundColor Cyan
  try {
    $resp = Invoke-RestMethod -Uri $queryUrl -Method Post -Headers $headers `
      -Body @{ query = $query } -ContentType 'application/x-www-form-urlencoded'
    Format-Result $resp
  } catch {
    Write-Host "  (query failed: $($_.Exception.Message))" -ForegroundColor Yellow
  }
}

Write-Host ''
Write-Host "Done. Feed 1a/1b into Step 1 and the 2e-vs-2f difference into Step 3 of"
Write-Host "docs/operations/slo.md -> 'Calibrating APIRouteHighErrorRate'."
