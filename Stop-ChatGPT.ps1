$ErrorActionPreference = 'Stop'
$statePath = Join-Path $PSScriptRoot '.local-data\web-status.json'
if (-not (Test-Path -LiteralPath $statePath)) { Write-Host 'Tool is not running.'; exit 0 }
$state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
$process = Get-CimInstance Win32_Process -Filter "ProcessId = $($state.pid)"
$expected = Join-Path $PSScriptRoot 'scripts\run-local-web.mjs'
if ($process -and $process.Name -eq 'node.exe' -and $process.CommandLine.Contains($expected)) {
    taskkill.exe /PID $state.pid /T /F | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not stop the local tool.' }
} elseif ($process) { throw 'PID belongs to a different process. Nothing stopped.' }
Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
Write-Host 'Desktop Commander Local stopped.'
