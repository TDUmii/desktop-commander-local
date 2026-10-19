$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Install Node.js >=22.12.0 first.' }
npm.cmd ci --ignore-scripts --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }
$release = Invoke-RestMethod -Uri 'https://api.github.com/repos/cloudflare/cloudflared/releases/latest' -Headers @{ 'User-Agent' = 'DesktopCommanderChatGPT' }
$asset = $release.assets | Where-Object { $_.name -eq 'cloudflared-windows-amd64.exe' }
if (-not $asset -or -not $asset.digest.StartsWith('sha256:')) { throw 'No verified Windows x64 cloudflared release found.' }
New-Item -ItemType Directory -Path .\local-bin -Force | Out-Null
$download = Join-Path $PSScriptRoot 'local-bin\cloudflared-download.exe'
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $download
$sha256 = (Get-FileHash -LiteralPath $download -Algorithm SHA256).Hash.ToLowerInvariant()
if ($asset.digest -ne "sha256:$sha256") { throw 'Cloudflared checksum mismatch.' }
Move-Item -LiteralPath $download -Destination (Join-Path $PSScriptRoot 'local-bin\cloudflared.exe') -Force
@{ version = $release.tag_name; sha256 = $sha256; source = $asset.browser_download_url } | ConvertTo-Json | Set-Content -LiteralPath .\local-bin\cloudflared-version.json -Encoding utf8
Write-Host 'Ready. Open Start-ChatGPT.cmd.'
