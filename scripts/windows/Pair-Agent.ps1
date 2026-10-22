[CmdletBinding()]
param(
    [string]$Hub,
    [string]$Name,
    [string]$Config = (Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) '.local-data\agent-config.json')
)

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $projectRoot
if (-not $Hub) { $Hub = Read-Host 'Hub URL (for example https://your-devtunnel-host)' }
$code = Read-Host 'One-time pairing code from the Hub dashboard'
if (-not $Name) { $Name = Read-Host 'Device name (leave blank to use the Windows hostname)' }
& (Join-Path $projectRoot 'scripts\windows\UmiBridge-Agent.ps1') -Hub $Hub -PairCode $code -Name $Name -Config $Config -Once
exit $LASTEXITCODE
