# Keeps the CHEK PC agent alive. Started hidden at logon (Startup folder → chek-agent.cmd), checks every 2 minutes.
$ErrorActionPreference = "SilentlyContinue"
$root = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $root "private\agent.pid"
while ($true) {
  $alive = $false
  if (Test-Path $pidFile) {
    $p = Get-Content $pidFile
    if ($p -and (Get-Process -Id $p -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -eq "node" })) { $alive = $true }
  }
  if (-not $alive) {
    Start-Process -FilePath "node" -ArgumentList "agent/run.mjs" -WorkingDirectory $root -WindowStyle Hidden
  }
  Start-Sleep -Seconds 120
}
