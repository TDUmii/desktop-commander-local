[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$stateDir = Join-Path $root '.local-data'
$statusPath = Join-Path $stateDir 'web-status.json'
$port = 43127
if ($env:DC_WEB_PORT) { $port = [int]$env:DC_WEB_PORT }
$dashboard = "http://127.0.0.1:$port/admin"

function Test-Dashboard {
    try {
        $response = Invoke-WebRequest -Uri $dashboard -UseBasicParsing -TimeoutSec 2
        return $response.StatusCode -eq 200
    } catch { return $false }
}

if (-not (Test-Dashboard)) {
    $node = Join-Path $root '.runtime\node\node.exe'
    if (-not (Test-Path -LiteralPath $node)) {
        $systemNode = Get-Command node.exe -ErrorAction SilentlyContinue
        if ($systemNode) { $node = $systemNode.Source }
    }
    if (-not (Test-Path -LiteralPath $node)) { throw 'Node.js was not found. Double-click Install-UmiBridge.cmd first.' }
    New-Item -ItemType Directory -Path $stateDir -Force | Out-Null
    $stdout = Join-Path $stateDir 'server.log'
    $stderr = Join-Path $stateDir 'server-error.log'
    Start-Process -FilePath $node -ArgumentList @((Join-Path $root 'scripts\run-local-web.mjs')) -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr | Out-Null
}

for ($attempt = 0; $attempt -lt 60; $attempt++) {
    if (Test-Dashboard) { Start-Process $dashboard; exit 0 }
    Start-Sleep -Seconds 1
}
throw 'UmiBridge did not start within 60 seconds. Open .local-data\server-error.log for details.'
