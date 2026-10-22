[CmdletBinding()]
param(
    [string]$Hub,
    [string]$Name,
    [string]$Config = (Join-Path $PSScriptRoot '.local-data\agent-config.json')
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not $Hub) { $Hub = Read-Host 'Hub URL (for example https://your-devtunnel-host)' }
$code = Read-Host 'One-time pairing code from the Hub dashboard'
if (-not $Name) { $Name = Read-Host 'Device name (leave blank to use the Windows hostname)' }
& (Join-Path $PSScriptRoot 'UmiBridge-Agent.ps1') -Hub $Hub -PairCode $code -Name $Name -Config $Config -Once
exit $LASTEXITCODE
