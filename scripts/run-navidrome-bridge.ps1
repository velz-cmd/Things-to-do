# Run on the Windows / WSL machine that hosts Navidrome SQLite.
# One-time: npm install better-sqlite3
#
#   .\scripts\run-navidrome-bridge.ps1
# Or set env inline (see scripts/navidrome-bridge.local.env.example)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$EnvFile = Join-Path $PSScriptRoot "navidrome-bridge.local.env"
if (Test-Path $EnvFile) {
  Get-Content $EnvFile | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
    $pair = $_ -split '=', 2
    if ($pair.Length -eq 2) {
      [System.Environment]::SetEnvironmentVariable($pair[0].Trim(), $pair[1].Trim())
    }
  }
}

if (-not $env:NAVIDROME_DB_PATH) {
  Write-Error "NAVIDROME_DB_PATH is required. Copy scripts/navidrome-bridge.local.env.example"
}

npx tsx scripts/navidrome-bridge.ts
