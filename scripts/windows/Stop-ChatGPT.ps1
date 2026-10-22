$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$ErrorActionPreference = 'Stop'
$statePath = Join-Path $projectRoot '.local-data\web-status.json'
if (-not (Test-Path -LiteralPath $statePath)) {
    Write-Host 'UmiBridge is not running (no saved session).'
    exit 0
}

$state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
$targetPid = [int]$state.pid
$port = [int]$state.port
$process = Get-CimInstance Win32_Process -Filter "ProcessId = $targetPid" -ErrorAction Stop
$expectedPath = Join-Path $projectRoot 'scripts\run-local-web.mjs'

if ($process) {
    $commandLine = [string]$process.CommandLine
    $absoluteMatch = $commandLine.IndexOf($expectedPath, [StringComparison]::OrdinalIgnoreCase) -ge 0
    # Older launchers may start Node using "scripts/run-local-web.mjs" relative to this project.
    # Accept that form ONLY if this exact process also owns the recorded loopback listener.
    $relativeMatch = $commandLine -match '(?i)(?:^|\s)"?(?:\.?[\\/])?scripts[\\/]run-local-web\.mjs"?(?:\s|$)'
    $portOwner = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
        Where-Object { $_.OwningProcess -eq $targetPid -and $_.LocalAddress -in @('127.0.0.1', '::1') }).Count -gt 0

    if ($process.Name -ne 'node.exe' -or -not ($absoluteMatch -or ($relativeMatch -and $portOwner))) {
        throw "Saved PID $targetPid does not match this UmiBridge instance. Nothing was stopped."
    }

    Write-Host "Stopping UmiBridge (PID $targetPid)..."
    & taskkill.exe /PID $targetPid /T /F | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Could not stop UmiBridge (PID $targetPid)."
    }
}

Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
Write-Host 'UmiBridge stopped. You can now run UmiBridge.cmd.'
