[CmdletBinding()]
param([switch]$PairedUrl, [switch]$BrowserExtension)

if ($BrowserExtension) { $PairedUrl = $true }

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$powershellExe = (Get-Command powershell.exe -ErrorAction Stop).Source
$nodeExe = Join-Path $PSScriptRoot '.runtime\node\node.exe'
if (-not (Test-Path -LiteralPath $nodeExe)) {
    $systemNode = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($systemNode) { $nodeExe = $systemNode.Source }
}
$nodeReady = $false
if (Test-Path -LiteralPath $nodeExe) {
    try { $nodeReady = [version]((& $nodeExe --version).TrimStart('v')) -ge [version]'22.12.0' } catch { }
}
$sdk = Join-Path $PSScriptRoot 'node_modules\@modelcontextprotocol\sdk\package.json'
$hasTunnel = Test-Path -LiteralPath (Join-Path $PSScriptRoot 'local-bin\cloudflared.exe')
if ($env:DC_PUBLIC_URL) { $hasTunnel = $true }
$tunnelConfig = Join-Path $PSScriptRoot '.local-data\tunnel-config.json'
if (Test-Path -LiteralPath $tunnelConfig) {
    $config = Get-Content -LiteralPath $tunnelConfig -Raw | ConvertFrom-Json
    if ($config.provider -eq 'devtunnel') {
        $hasTunnel = Test-Path -LiteralPath (Join-Path $PSScriptRoot '.runtime\devtunnel\devtunnel.exe')
    }
}

if (-not $nodeReady -or -not (Test-Path -LiteralPath $sdk) -or (-not $BrowserExtension -and -not $hasTunnel)) {
    & $powershellExe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'Setup-Local.ps1')
    if ($LASTEXITCODE -ne 0) { throw 'UmiBridge installation failed.' }
    $nodeExe = Join-Path $PSScriptRoot '.runtime\node\node.exe'
    if (-not (Test-Path -LiteralPath $nodeExe)) { $nodeExe = (Get-Command node.exe -ErrorAction Stop).Source }
}
$npmExe = Join-Path (Split-Path -Parent $nodeExe) 'npm.cmd'
& $npmExe run build
if ($LASTEXITCODE -ne 0) { throw 'UmiBridge build failed.' }

$stateDir = Join-Path $PSScriptRoot '.local-data'
$pairingPath = Join-Path $stateDir 'gemini-pairing-secret.txt'
if ($PairedUrl) {
    New-Item -ItemType Directory -Path $stateDir -Force | Out-Null
    & $powershellExe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'scripts\protect-local-data.ps1') -Path $stateDir
    if ($LASTEXITCODE -ne 0) { throw 'Cannot protect the local pairing directory.' }
    $validPairingSecret = (Test-Path -LiteralPath $pairingPath) -and ((Get-Content -LiteralPath $pairingPath -Raw).Trim() -cmatch '^[A-Za-z0-9_-]{43}$')
    if (-not $validPairingSecret) {
        $bytes = New-Object byte[] 32
        $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
        try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
        $pairingSecret = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
        [IO.File]::WriteAllText($pairingPath, $pairingSecret + "`n", (New-Object Text.UTF8Encoding $false))
        $pairingSecret = $null
    }
    # Reload only this bridge so the opt-in credential is active; OAuth grants are persisted.
    & $powershellExe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'Stop-ChatGPT.ps1')
    if ($LASTEXITCODE -ne 0) { throw 'Could not stop the existing UmiBridge instance.' }
}

# Run the launcher in a child shell because its successful exit must not stop this setup script.
# The launcher reuses a healthy server and starts a new server hidden only when needed.
if ($BrowserExtension) {
    & $powershellExe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'Start-UmiBridge.ps1') -LocalOnly
} else {
    & $powershellExe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'Start-UmiBridge.ps1')
}
if ($LASTEXITCODE -ne 0) { throw 'UmiBridge could not start.' }

$statePath = Join-Path $PSScriptRoot '.local-data\web-status.json'
$status = $null
for ($attempt = 0; $attempt -lt 15; $attempt++) {
    try {
        $candidate = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
        $endpoint = [uri]$candidate.endpoint
        $process = Get-Process -Id ([int]$candidate.pid) -ErrorAction Stop
        $health = Invoke-WebRequest -Uri ("http://127.0.0.1:{0}/health" -f [int]$candidate.port) -UseBasicParsing -TimeoutSec 2
        $validScheme = $endpoint.Scheme -eq 'https' -or ($BrowserExtension -and $endpoint.Scheme -eq 'http' -and $endpoint.Host -eq '127.0.0.1')
        if ($process -and $health.StatusCode -eq 200 -and $endpoint.IsAbsoluteUri -and $validScheme -and $endpoint.AbsolutePath -eq '/mcp' -and -not $endpoint.UserInfo -and -not $endpoint.Query -and -not $endpoint.Fragment) {
            $status = $candidate
            break
        }
    } catch { }
    Start-Sleep -Seconds 1
}
if (-not $status) { throw 'No live HTTPS MCP endpoint was found. Check the local dashboard and .local-data\server-error.log.' }

$usesPairedUrl = Test-Path -LiteralPath $pairingPath
if ($usesPairedUrl) {
    $pairedEndpoint = (Get-Content -LiteralPath (Join-Path $stateDir 'GEMINI-CONNECT.txt') -Raw).Trim()
    $pairedUri = [uri]$pairedEndpoint
    $expectedOrigin = ([uri]$status.endpoint).GetLeftPart([UriPartial]::Authority)
    if ($pairedUri.GetLeftPart([UriPartial]::Authority) -ne $expectedOrigin -or $pairedUri.AbsolutePath -notmatch '^/gemini/[A-Za-z0-9_-]{43}/mcp$' -or $pairedUri.UserInfo -or $pairedUri.Query -or $pairedUri.Fragment) {
        throw 'No current private Gemini pairing URL was found. Run Setup-Gemini-Paired.cmd again.'
    }
    if ($BrowserExtension) {
        $pairedEndpoint = 'http://127.0.0.1:' + [int]$status.port + $pairedUri.AbsolutePath
    }
    Set-Clipboard -Value $pairedEndpoint
} else { Set-Clipboard -Value $status.endpoint }
if ($BrowserExtension) {
    Start-Process 'https://chromewebstore.google.com/detail/mcp-superassistant/kngiafgkdnlkgmefdafaibkibegkcaef'
    Start-Process 'https://gemini.google.com/app?hl=en'
    Write-Host 'Browser extension mode: install MCP SuperAssistant, then open its connection settings in Gemini.' -ForegroundColor Green
    Write-Host 'Select Streamable HTTP, paste the private loopback URL from the clipboard, and connect.'
    Write-Host 'Enable the desired tools and insert the extension working instructions into a new chat.'
    Write-Host 'Keep automatic execution off until you have verified a harmless file test.'
    Write-Host 'This optional path avoids the native Gemini custom-app transport. Live compatibility depends on the extension and Gemini UI.'
    Write-Host 'Treat the clipboard URL as a credential. Never paste it into chat, Git, or a screenshot.'
    exit 0
}
Start-Process 'https://gemini.google.com/customize/connectors?hl=en'
Write-Host ''
Write-Host 'UmiBridge is ready for Gemini. The live MCP server URL is copied to your clipboard.' -ForegroundColor Green
Write-Host 'In Gemini, add a custom MCP server and paste the URL.'
if ($usesPairedUrl) {
    Write-Host 'Private pairing mode: the URL itself is a credential. Paste it only into the Gemini MCP server field.'
    Write-Host 'Do not paste it into chat, screenshots, Git, or public documents. OAuth remains enabled on the regular /mcp endpoint.'
} else {
    Write-Host 'Select OAuth when asked. Use the connection code from .local-data\CONNECT.txt on the UmiBridge authorization page.'
    Write-Host 'If Google account linking stays blank, use Setup-Gemini-Paired.cmd for private URL pairing.'
}
Write-Host 'If your Gemini account does not show custom MCP servers, this feature is not available for that account yet.'
Write-Host 'ChatGPT continues to use the same UmiBridge server.'
