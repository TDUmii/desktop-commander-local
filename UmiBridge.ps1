[CmdletBinding()]
param(
    [switch]$NoUpdate,
    [switch]$NoTunnelRepair,
    [switch]$LocalOnly,
    [switch]$Monitor
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$root = $PSScriptRoot
Set-Location -LiteralPath $root
$stateDir = Join-Path $root '.local-data'
$logPath = Join-Path $stateDir 'launcher-error.log'
$statusPath = Join-Path $stateDir 'web-status.json'
$port = 43127
if ($env:DC_WEB_PORT) { $port = [int]$env:DC_WEB_PORT }

New-Item -ItemType Directory -Path $stateDir -Force | Out-Null

function Write-LauncherLog([string]$Message) {
    $stamp = (Get-Date).ToString('s')
    Add-Content -LiteralPath $logPath -Value "$stamp $Message" -Encoding utf8
}

function Get-UsableNode {
    $minimum = [version]'22.12.0'
    $local = Join-Path $root '.runtime\node\node.exe'
    $candidates = @()
    if (Test-Path -LiteralPath $local) { $candidates += $local }
    $system = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($system) { $candidates += $system.Source }
    foreach ($candidate in ($candidates | Select-Object -Unique)) {
        try {
            $raw = (& $candidate --version 2>$null | Select-Object -First 1).ToString().Trim()
            if ($raw -match '^v(?<version>\d+\.\d+\.\d+)' -and ([version]$Matches.version -ge $minimum)) {
                return $candidate
            }
        } catch { }
    }
    return $null
}

function Get-TunnelConfig {
    $path = Join-Path $stateDir 'tunnel-config.json'
    if (-not (Test-Path -LiteralPath $path)) { return $null }
    try { $config = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json } catch { throw 'tunnel-config.json is unreadable. Run stable tunnel setup again.' }
    if ($config.provider -ne 'devtunnel' -or $config.tunnelId -notmatch '^[a-zA-Z0-9][a-zA-Z0-9.-]{2,99}$' -or [int]$config.port -ne $port) {
        throw 'tunnel-config.json does not match the current port. Run stable tunnel setup again.'
    }
    return $config
}

function Get-RunningStatus {
    if (-not (Test-Path -LiteralPath $statusPath)) { return $null }
    try {
        $status = Get-Content -LiteralPath $statusPath -Raw | ConvertFrom-Json
        Get-Process -Id ([int]$status.pid) -ErrorAction Stop | Out-Null
        $health = Invoke-WebRequest -Uri ("http://127.0.0.1:{0}/health" -f $port) -UseBasicParsing -TimeoutSec 2
        if ($health.StatusCode -eq 200) { return $status }
    } catch { }
    return $null
}

function Watch-Requests {
    $historyPath = Join-Path $stateDir 'request-history.jsonl'
    $lastRequestId = $null
    $lastState = $null
    $hasSeenHistory = $false
    Write-Host ''
    Write-Host 'Monitoring gateway requests. Press Ctrl+C to stop watching.' -ForegroundColor Cyan
    Write-Host 'The gateway stays in the background; use Stop-ChatGPT.cmd when you want to stop it.' -ForegroundColor DarkGray
    while ($true) {
        $running = Get-RunningStatus
        $state = if ($running) { 'online' } else { 'offline' }
        if ($state -ne $lastState) {
            if ($running) {
                $provider = if ($running.tunnelProvider) { [string]$running.tunnelProvider } else { 'local' }
                Write-Host ("[{0}] gateway online ({1})" -f (Get-Date).ToString('HH:mm:ss'), $provider) -ForegroundColor Green
            } else {
                Write-Host ("[{0}] gateway offline; waiting for it to return" -f (Get-Date).ToString('HH:mm:ss')) -ForegroundColor Yellow
            }
            $lastState = $state
        }
        if (Test-Path -LiteralPath $historyPath) {
            try {
                $line = Get-Content -LiteralPath $historyPath -Tail 1 -ErrorAction Stop
                if ($line) {
                    $entry = $line | ConvertFrom-Json
                    if ($entry.id -and $entry.id -ne $lastRequestId) {
                        $status = if ($entry.status) { [string]$entry.status } else { 'unknown' }
                        $tool = if ($entry.toolName) { [string]$entry.toolName } else { 'request' }
                        $time = (Get-Date).ToString('HH:mm:ss')
                        try { $time = ([datetime]$entry.timestamp).ToLocalTime().ToString('HH:mm:ss') } catch { }
                        $kind = if ($hasSeenHistory) { 'request' } else { 'last' }
                        Write-Host ("[{0}] {1} {2} - {3}" -f $time, $kind, $tool, $status) -ForegroundColor White
                        $lastRequestId = [string]$entry.id
                        $hasSeenHistory = $true
                    }
                }
            } catch { }
        }
        Start-Sleep -Seconds 2
    }
}

function Invoke-PowerShellScript([string]$Path, [string[]]$Arguments = @(), [switch]$Quiet) {
    if ($Quiet) { & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Path @Arguments *> $null }
    else { & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Path @Arguments }
    if ($LASTEXITCODE -ne 0) { throw "Script failed: $([IO.Path]::GetFileName($Path))." }
}

function Stop-Bridge {
    $stop = Join-Path $root 'Stop-ChatGPT.ps1'
    if (Test-Path -LiteralPath $stop) { Invoke-PowerShellScript $stop }
}

function Test-DevTunnelLogin([string]$Cli, $Config) {
    if (-not (Test-Path -LiteralPath $Cli)) { return $false }
    # `user show` can remain successful after the access token has expired.
    # Probe the configured tunnel API instead so the launcher can repair the
    # login before falling back to a temporary URL.
    try {
        & $Cli show ([string]$Config.tunnelId) --json *> $null
        return $LASTEXITCODE -eq 0
    } catch { return $false }
}

function Test-DevTunnelPort([string]$Cli, $Config) {
    if (-not $Config.port) { return $false }
    try {
        & $Cli port show ([string]$Config.tunnelId) -p ([string]$Config.port) --json *> $null
        return $LASTEXITCODE -eq 0
    } catch { return $false }
}

function Update-Source {
    if ($NoUpdate -or -not (Test-Path -LiteralPath (Join-Path $root '.git'))) { return $false }
    $git = Get-Command git.exe -ErrorAction SilentlyContinue
    if (-not $git) { Write-Host 'Git is not available; skipping source update.'; return $false }
    try {
        $branch = (& $git.Source branch --show-current 2>$null | Select-Object -First 1).ToString().Trim()
        if (-not $branch) { Write-Host 'Detached HEAD; skipping automatic source update.'; return $false }
        $dirty = (& $git.Source status --porcelain --untracked-files=no 2>$null | Out-String).Trim()
        if ($dirty) { Write-Host 'Local source changes found; keeping them and skipping update.'; return $false }
        & $git.Source fetch --all --prune --quiet 2>$null
        if ($LASTEXITCODE -ne 0) { Write-Host 'Git fetch failed; continuing with the local source.'; return $false }
        $upstream = (& $git.Source rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>$null | Select-Object -First 1).ToString().Trim()
        if (-not $upstream) { return $false }
        $behindText = (& $git.Source rev-list --count ("HEAD.." + $upstream) 2>$null | Select-Object -First 1).ToString().Trim()
        $behind = 0
        if ([int]::TryParse($behindText, [ref]$behind) -and $behind -gt 0) {
            Write-Host ("Updating {0} commit from {1}..." -f $behind, $upstream)
            & $git.Source pull --ff-only --quiet 2>$null
            if ($LASTEXITCODE -ne 0) { throw 'Git fast-forward failed.' }
            Write-Host 'Source updated.' -ForegroundColor Green
            return $true
        }
    } catch {
        Write-LauncherLog ('UPDATE_SKIPPED ' + $_.Exception.Message)
        Write-Host 'Automatic update did not complete; keeping the local source.'
    }
    return $false
}

function Test-ProjectRuntime {
    $node = Get-UsableNode
    $sdk = Test-Path -LiteralPath (Join-Path $root 'node_modules\@modelcontextprotocol\sdk\package.json')
    if (-not $node -or -not $sdk) { return $false }
    $npm = Join-Path (Split-Path -Parent $node) 'npm.cmd'
    if (-not (Test-Path -LiteralPath $npm)) { return $false }
    & $npm run build --silent *> $null
    return $LASTEXITCODE -eq 0
}

try {
    Write-Host 'UmiBridge Sakura Console - one-click start' -ForegroundColor Cyan
    $updated = Update-Source
    $stable = Get-TunnelConfig
    $cloudflared = Test-Path -LiteralPath (Join-Path $root 'local-bin\cloudflared.exe')
    $externalUrl = -not [string]::IsNullOrWhiteSpace($env:DC_PUBLIC_URL)
    $needsTunnelBinary = -not $LocalOnly -and -not $externalUrl -and -not $stable -and -not $cloudflared

    if ($updated -or -not (Test-ProjectRuntime) -or $needsTunnelBinary) {
        Write-Host 'Checking or repairing the runtime and dependencies...'
        $setup = Join-Path $root 'Setup-Local.ps1'
        $setupArgs = @()
        if ($stable -or $externalUrl -or $LocalOnly) { $setupArgs += '-SkipCloudflared' }
        Invoke-PowerShellScript $setup $setupArgs
        $stable = Get-TunnelConfig
    }
    if (-not (Test-ProjectRuntime)) { throw 'UmiBridge build still fails after runtime repair.' }

    $fallbackTunnel = $false
    if (-not $LocalOnly -and -not $NoTunnelRepair -and $stable) {
        $devtunnel = Join-Path $root '.runtime\devtunnel\devtunnel.exe'
        if (Test-DevTunnelLogin $devtunnel $stable) {
            if (Test-DevTunnelPort $devtunnel $stable) {
                Write-Host 'Reusing the saved persistent tunnel and host.'
            } else {
                try {
                    Write-Host 'Checking or repairing the persistent tunnel and host...'
                    Invoke-PowerShellScript (Join-Path $root 'Setup-Stable-Connection.ps1') -Quiet
                    $stable = Get-TunnelConfig
                } catch {
                    Write-LauncherLog ('STABLE_TUNNEL_FAILED ' + $_.Exception.Message)
                    Write-Host 'Persistent tunnel repair failed; using a temporary Quick Tunnel.'
                    $fallbackTunnel = $true
                }
            }
        } else {
            try {
                Write-Host 'Refreshing the persistent tunnel login...'
                Invoke-PowerShellScript (Join-Path $root 'Setup-Stable-Connection.ps1') -Quiet
                $stable = Get-TunnelConfig
            } catch {
                Write-LauncherLog ('STABLE_TUNNEL_LOGIN_UNAVAILABLE ' + $_.Exception.Message)
                Write-Host 'Persistent tunnel login is unavailable; using a temporary Quick Tunnel.'
                $fallbackTunnel = $true
            }
        }
        if ($fallbackTunnel -and -not (Test-Path -LiteralPath (Join-Path $root 'local-bin\cloudflared.exe'))) {
            Write-Host 'Installing the fallback Quick Tunnel runtime...'
            Invoke-PowerShellScript (Join-Path $root 'Setup-Local.ps1')
        }
    }

    $running = Get-RunningStatus
    $mustRestart = $false
    if ($running) {
        if ($LocalOnly -and $running.tunnelProvider -ne 'local') { $mustRestart = $true }
        elseif ($fallbackTunnel -and $running.tunnelProvider -eq 'devtunnel') { $mustRestart = $true }
        elseif (-not $LocalOnly -and $stable -and -not $fallbackTunnel -and $running.tunnelProvider -ne 'devtunnel') { $mustRestart = $true }
        elseif (-not $LocalOnly -and -not $stable -and $running.tunnelProvider -eq 'local') { $mustRestart = $true }
        elseif ($stable -and -not $fallbackTunnel -and $running.publicUrl -and $stable.publicUrl -and $running.publicUrl -ne $stable.publicUrl) { $mustRestart = $true }
    }
    if ($mustRestart) {
        Write-Host 'Switching the gateway to the current tunnel/host...'
        Stop-Bridge
    }

    $start = Join-Path $root 'Start-UmiBridge.ps1'
    $startArgs = @()
    if ($LocalOnly) { $startArgs += '-LocalOnly' }
    $previousDisableSavedTunnel = $env:DC_DISABLE_SAVED_TUNNEL
    try {
        if ($fallbackTunnel) { $env:DC_DISABLE_SAVED_TUNNEL = '1' }
        Invoke-PowerShellScript $start $startArgs
    } finally {
        $env:DC_DISABLE_SAVED_TUNNEL = $previousDisableSavedTunnel
    }

    Write-Host ''
    Write-Host 'UmiBridge is ready.' -ForegroundColor Green
    Write-Host ("Dashboard: http://127.0.0.1:{0}/admin" -f $port)
    Write-Host 'ChatGPT and Gemini share this gateway; the launcher has no provider mode to choose.'
    Write-Host 'The gateway runs in the background; this window now monitors received requests.'
    if ($Monitor) { Watch-Requests }
} catch {
    $message = $_.Exception.Message
    Write-LauncherLog ('ERROR ' + $message)
    Write-Error ('UmiBridge could not start: ' + $message)
    exit 1
}
