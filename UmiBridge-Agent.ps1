[CmdletBinding()]
param(
    [string]$Config = (Join-Path $PSScriptRoot '.local-data\agent-config.json'),
    [string]$Hub,
    [string]$PairCode,
    [string]$Name,
    [switch]$Once,
    [ValidateRange(500, 30000)][int]$IntervalMs = 1500
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
function Find-AgentNode {
    $localNode = Join-Path $PSScriptRoot '.runtime\node\node.exe'
    if (Test-Path -LiteralPath $localNode) { return $localNode }
    $systemNode = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($systemNode) { return $systemNode.Source }
    return $null
}
$node = Find-AgentNode
if (-not $node) {
    $setup = Join-Path $PSScriptRoot 'Setup-Local.ps1'
    if (-not (Test-Path -LiteralPath $setup)) { throw 'Node.js 22 or newer is required and Setup-Local.ps1 is missing.' }
    Write-Host 'Node.js is missing; installing the project runtime and dependencies once...' -ForegroundColor Cyan
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $setup -SkipCloudflared
    if ($LASTEXITCODE -ne 0) { throw 'Agent setup failed. Run Setup-Local.ps1 manually to see the full diagnostic.' }
    $node = Find-AgentNode
}
if (-not $node) { throw 'Node.js 22 or newer is required. Agent setup did not produce a usable runtime.' }
$script = Join-Path $PSScriptRoot 'scripts\agent-runtime.mjs'
$arguments = @($script, '--config', $Config, '--interval-ms', "$IntervalMs")
if ($Hub) { $arguments += @('--hub', $Hub) }
if ($PairCode) { $arguments += @('--pair-code', $PairCode) }
if ($Name) { $arguments += @('--name', $Name) }
if ($Once) { $arguments += '--once' }
& $node @arguments
exit $LASTEXITCODE
