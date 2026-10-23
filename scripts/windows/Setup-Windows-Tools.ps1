[CmdletBinding()]
param([switch]$Force)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$runtimeRoot = [IO.Path]::GetFullPath((Join-Path $projectRoot '.runtime'))
$workerRoot = Join-Path $runtimeRoot 'windows-tools'
$pythonExe = Join-Path $workerRoot 'Scripts\python.exe'
$uvRoot = Join-Path $runtimeRoot 'uv'
$uvExe = Join-Path $uvRoot 'uv.exe'
$requirements = Join-Path $projectRoot 'scripts\windows-tools-requirements.txt'
$stateRoot = Join-Path $projectRoot '.local-data'
$logFile = Join-Path $stateRoot 'windows-tools-setup.log'
$readyFile = Join-Path $workerRoot 'umibridge-ready.json'
$uvVersion = '0.13.5'
$pythonVersion = '3.14.7'
$packageVersion = '0.8.8'
$sourceCommit = 'e28abb5c6934cb3427190bdb970e02644c915ae3'
$sourceHash = '08e603c6674e79c0d44e7d3687a94e3de1ac92c0c53c868a9e656e8b091fb9b3'
$sourceRoot = Join-Path $runtimeRoot 'windows-mcp-source'
$sourceEntry = Join-Path $sourceRoot 'src\windows_mcp\__main__.py'
$uvArchiveHash = 'a38b8d1902b7cfbc76b423ba1bb456f623f42064cdc72628b6075b89afd1019a'
$uvExecutableHash = 'f45d1cb9d9140ca6d3f4005fdfc0ebeccf849fd04d1dc85804155cb923f1597b'

if ($env:OS -ne 'Windows_NT' -or -not [Environment]::Is64BitOperatingSystem -or $env:PROCESSOR_ARCHITECTURE -eq 'ARM64') {
    throw 'The Windows tools require Windows x64.'
}
if (-not (Test-Path -LiteralPath $requirements -PathType Leaf)) { throw 'The Windows tools dependency lock is missing.' }
New-Item -ItemType Directory -Path $runtimeRoot, $stateRoot -Force | Out-Null

function Assert-RuntimePath([string]$Path) {
    $fullPath = [IO.Path]::GetFullPath($Path)
    if (-not $fullPath.StartsWith(($runtimeRoot.TrimEnd('\') + '\'), [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Refusing to change a path outside the local runtime directory.'
    }
    return $fullPath
}

function ConvertTo-ProcessArgument([string]$Value) {
    if ($Value.Length -gt 0 -and $Value -notmatch '[\s"]') { return $Value }
    return '"' + (($Value -replace '(\\*)"', '$1$1\"') -replace '(\\+)$', '$1$1') + '"'
}

function Invoke-Hidden([string]$Executable, [string[]]$Arguments, [int]$TimeoutSeconds = 600) {
    $startInfo = New-Object Diagnostics.ProcessStartInfo
    $startInfo.FileName = $Executable
    $startInfo.Arguments = (($Arguments | ForEach-Object { ConvertTo-ProcessArgument $_ }) -join ' ')
    $startInfo.WorkingDirectory = $projectRoot
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.WindowStyle = [Diagnostics.ProcessWindowStyle]::Hidden
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    # This worker never uses account-level Python packages, indexes or startup settings.
    foreach ($key in @('PYTHONPATH', 'PYTHONHOME', 'UV_INDEX', 'UV_EXTRA_INDEX_URL', 'UV_INDEX_URL', 'UV_FIND_LINKS', 'UV_NO_INDEX', 'UV_CONFIG_FILE', 'UV_PROJECT', 'UV_WORKING_DIR', 'UV_INSECURE_HOST', 'UV_PYTHON_INSTALL_MIRROR', 'UV_PYTHON_DOWNLOADS_JSON_URL', 'UV_PYTHON_DOWNLOADS', 'UV_PYTHON', 'VIRTUAL_ENV')) {
        $startInfo.EnvironmentVariables.Remove($key)
    }
    $startInfo.EnvironmentVariables['ANONYMIZED_TELEMETRY'] = 'false'
    $startInfo.EnvironmentVariables['PYTHONNOUSERSITE'] = '1'
    $startInfo.EnvironmentVariables['UV_NO_CONFIG'] = '1'
    $startInfo.EnvironmentVariables['UV_CACHE_DIR'] = Join-Path $runtimeRoot 'uv-cache'
    $startInfo.EnvironmentVariables['UV_PYTHON_INSTALL_DIR'] = Join-Path $runtimeRoot 'python'
    $startInfo.EnvironmentVariables['UV_PYTHON_BIN_DIR'] = Join-Path $runtimeRoot 'python-bin'
    $startInfo.EnvironmentVariables['UV_KEYRING_PROVIDER'] = 'disabled'
    $startInfo.EnvironmentVariables['UV_NO_PROGRESS'] = '1'
    $child = New-Object Diagnostics.Process
    $child.StartInfo = $startInfo
    try {
        if (-not $child.Start()) { throw 'Could not start the Windows tools setup helper.' }
        $stdoutTask = $child.StandardOutput.ReadToEndAsync()
        $stderrTask = $child.StandardError.ReadToEndAsync()
        if (-not $child.WaitForExit($TimeoutSeconds * 1000)) {
            $child.Kill()
            throw 'Windows tools setup timed out; run UmiBridge again to retry.'
        }
        $output = $stdoutTask.Result + $stderrTask.Result
        if ($output) { [IO.File]::AppendAllText($logFile, $output + [Environment]::NewLine) }
        if ($child.ExitCode -ne 0) { throw "Windows tools setup failed (exit $($child.ExitCode)). See .local-data\windows-tools-setup.log." }
        return $stdoutTask.Result.Trim()
    } finally { $child.Dispose() }
}

function Install-PortableUv {
    if ((Test-Path -LiteralPath $uvExe -PathType Leaf) -and
        (Get-FileHash -LiteralPath $uvExe -Algorithm SHA256).Hash.ToLowerInvariant() -eq $uvExecutableHash) { return }
    Write-Host 'Installing the verified local Windows tools helper...'
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $stage = Assert-RuntimePath (Join-Path $runtimeRoot ('windows-tools-download-' + [guid]::NewGuid().ToString('N')))
    New-Item -ItemType Directory -Path $stage, $uvRoot -Force | Out-Null
    try {
        $archive = Join-Path $stage 'uv.zip'
        $source = "https://github.com/astral-sh/uv/releases/download/$uvVersion/uv-x86_64-pc-windows-msvc.zip"
        Invoke-WebRequest -Uri $source -OutFile $archive -UseBasicParsing -Headers @{ 'User-Agent' = 'UmiBridge' }
        if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $uvArchiveHash) { throw 'Windows tools helper download failed SHA-256 verification.' }
        Expand-Archive -LiteralPath $archive -DestinationPath (Join-Path $stage 'extracted')
        $extracted = Join-Path $stage 'extracted\uv.exe'
        if ((Get-FileHash -LiteralPath $extracted -Algorithm SHA256).Hash.ToLowerInvariant() -ne $uvExecutableHash) { throw 'Windows tools helper executable failed SHA-256 verification.' }
        Copy-Item -LiteralPath $extracted -Destination $uvExe -Force
    } finally {
        Remove-Item -LiteralPath (Assert-RuntimePath $stage) -Recurse -Force -ErrorAction SilentlyContinue
    }
}

function Install-ReviewedSource {
    Write-Host 'Preparing the verified Windows desktop engine...'
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $archive = Assert-RuntimePath (Join-Path $runtimeRoot "windows-mcp-$sourceCommit.zip")
    if (-not (Test-Path -LiteralPath $archive -PathType Leaf) -or
        (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $sourceHash) {
        Invoke-WebRequest -Uri "https://codeload.github.com/CursorTouch/Windows-MCP/zip/$sourceCommit" -OutFile $archive -UseBasicParsing -Headers @{ 'User-Agent' = 'UmiBridge' }
    }
    if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $sourceHash) { throw 'Windows desktop source failed SHA-256 verification.' }
    $stage = Assert-RuntimePath (Join-Path $runtimeRoot ('windows-source-download-' + [guid]::NewGuid().ToString('N')))
    try {
        Expand-Archive -LiteralPath $archive -DestinationPath $stage
        $extracted = Join-Path $stage "Windows-MCP-$sourceCommit"
        if (-not (Test-Path -LiteralPath (Join-Path $extracted 'src\windows_mcp\__main__.py') -PathType Leaf) -or
            -not (Test-Path -LiteralPath (Join-Path $extracted 'LICENSE.md') -PathType Leaf)) { throw 'Windows desktop source archive has an unexpected layout.' }
        if (Test-Path -LiteralPath $sourceRoot) { Remove-Item -LiteralPath (Assert-RuntimePath $sourceRoot) -Recurse -Force }
        New-Item -ItemType Directory -Path $sourceRoot -Force | Out-Null
        Copy-Item -LiteralPath (Join-Path $extracted 'src') -Destination $sourceRoot -Recurse
        Copy-Item -LiteralPath (Join-Path $extracted 'LICENSE.md') -Destination $sourceRoot
    } finally {
        Remove-Item -LiteralPath (Assert-RuntimePath $stage) -Recurse -Force -ErrorAction SilentlyContinue
    }
}

$lockHash = (Get-FileHash -LiteralPath $requirements -Algorithm SHA256).Hash.ToLowerInvariant()
$checkCode = "import importlib.metadata as m,sys; assert sys.version_info[:2] == (3,14); assert m.version('windows-mcp') == '$packageVersion'; import windows_mcp"
if (-not $Force -and (Test-Path -LiteralPath $readyFile -PathType Leaf) -and (Test-Path -LiteralPath $pythonExe -PathType Leaf)) {
    try {
        $ready = Get-Content -LiteralPath $readyFile -Raw | ConvertFrom-Json
        if ($ready.lock_sha256 -eq $lockHash -and $ready.source_commit -eq $sourceCommit -and
            $ready.source_sha256 -eq $sourceHash -and (Test-Path -LiteralPath $sourceEntry -PathType Leaf)) {
            $null = Invoke-Hidden $pythonExe @('-I', '-c', $checkCode) 30
            Write-Host 'Windows tools are ready.'
            return
        }
    } catch { }
}

Install-PortableUv
Write-Host 'Preparing the private Python runtime and Windows tools...'
$null = Invoke-Hidden $uvExe @('python', 'install', $pythonVersion, '--no-bin', '--no-registry')
if (Test-Path -LiteralPath $pythonExe -PathType Leaf) {
    try { $null = Invoke-Hidden $pythonExe @('-I', '-c', 'import sys; assert sys.version_info[:3] == (3,14,7)') 30 }
    catch {
        # Only the dedicated environment is replaceable; account Python installs are untouched.
        Remove-Item -LiteralPath (Assert-RuntimePath $workerRoot) -Recurse -Force
    }
}
if (-not (Test-Path -LiteralPath $pythonExe -PathType Leaf)) {
    $null = Invoke-Hidden $uvExe @('venv', $workerRoot, '--python', $pythonVersion, '--managed-python', '--no-python-downloads')
}
$syncArgs = @('pip', 'sync', $requirements, '--python', $pythonExe, '--require-hashes', '--only-binary', ':all:', '--default-index', 'https://pypi.org/simple', '--no-config')
if ($Force) { $syncArgs += '--reinstall' }
$null = Invoke-Hidden $uvExe $syncArgs
Install-ReviewedSource
$null = Invoke-Hidden $pythonExe @('-I', '-c', $checkCode) 30
@{ package = 'windows-mcp'; version = $packageVersion; python = $pythonVersion; uv = $uvVersion; lock_sha256 = $lockHash; source_commit = $sourceCommit; source_sha256 = $sourceHash } |
    ConvertTo-Json | Set-Content -LiteralPath $readyFile -Encoding utf8
Write-Host 'Windows tools are ready.'
