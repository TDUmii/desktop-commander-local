import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const setup = await readFile(new URL('../Setup-Local.ps1', import.meta.url), 'utf8');
const stableSetup = await readFile(new URL('../Setup-Stable-Connection.ps1', import.meta.url), 'utf8');
const launcher = await readFile(new URL('../Start-ChatGPT.cmd', import.meta.url), 'utf8');
const compatibilityLauncher = await readFile(new URL('../Start-UmiBridge.cmd', import.meta.url), 'utf8');
const unifiedLauncher = await readFile(new URL('../UmiBridge.cmd', import.meta.url), 'utf8');
const unifiedScript = await readFile(new URL('../UmiBridge.ps1', import.meta.url), 'utf8');
const agentLauncher = await readFile(new URL('../UmiBridge-Agent.ps1', import.meta.url), 'utf8');
const pairLauncher = await readFile(new URL('../Pair-Agent.ps1', import.meta.url), 'utf8');
const agentRuntime = await readFile(new URL('../scripts/agent-runtime.mjs', import.meta.url), 'utf8');
const commandSession = await readFile(new URL('../scripts/command-session.mjs', import.meta.url), 'utf8');
const webLauncher = await readFile(new URL('../scripts/run-local-web.mjs', import.meta.url), 'utf8');
const dashboard = await readFile(new URL('../scripts/admin-dashboard.html', import.meta.url), 'utf8');

test('one-click launcher bootstraps a verified local runtime and launches the app', () => {
  assert.match(setup, /https:\/\/nodejs\.org\/dist\/index\.json/);
  assert.match(setup, /SHASUMS256\.txt/);
  assert.match(setup, /Get-FileHash.*SHA256/);
  assert.match(setup, /\$npmExe ci --ignore-scripts --no-audit --no-fund/);
  assert.match(setup, /cloudflared-windows-amd64\.exe/);
  assert.match(setup, /Start-Process -FilePath \$startFile/);
  assert.match(launcher, /\.runtime\\node\\node\.exe/);
  assert.match(launcher, /UmiBridge\.cmd/);
  assert.match(compatibilityLauncher, /call .*UmiBridge\.cmd/i);
  assert.doesNotMatch(compatibilityLauncher, /Start-UmiBridge\.ps1/);
});

test('unified launcher repairs, updates, hosts and starts one shared ChatGPT/Gemini gateway', () => {
  assert.match(unifiedLauncher, /UmiBridge\.ps1/i);
  assert.match(unifiedLauncher, /-Monitor/i);
  assert.match(unifiedScript, /git.Source fetch/);
  assert.match(unifiedScript, /Setup-Local\.ps1/);
  assert.match(unifiedScript, /Setup-Stable-Connection\.ps1/);
  assert.match(unifiedScript, /Start-UmiBridge\.ps1/);
  assert.match(unifiedScript, /Test-DevTunnelLogin/);
  assert.match(unifiedScript, /DC_DISABLE_SAVED_TUNNEL/);
  assert.match(unifiedScript, /\$fallbackTunnel = \[bool\]\$TemporaryTunnel/);
  assert.doesNotMatch(unifiedScript, /\$fallbackTunnel = \$true/);
  assert.match(unifiedScript, /Watch-Requests/);
  assert.match(webLauncher, /DC_DISABLE_SAVED_TUNNEL === '1'/);
  assert.match(unifiedScript, /ChatGPT and Gemini share this gateway/i);
});

test('multi-device Agent launchers pair outbound workers without exposing a listener', () => {
  assert.match(pairLauncher, /pairing code/i);
  assert.match(pairLauncher, /UmiBridge-Agent\.ps1/);
  assert.match(agentLauncher, /agent-runtime\.mjs/);
  assert.match(agentLauncher, /--config/);
  assert.match(agentLauncher, /Setup-Local\.ps1/);
  assert.match(agentLauncher, /SkipCloudflared/);
  assert.match(agentRuntime, /\/agent\/pair/);
  assert.match(agentRuntime, /\/agent\/poll/);
  assert.match(agentRuntime, /\/agent\/result/);
  assert.match(agentRuntime, /commandSession.start\(\)/);
  assert.match(commandSession, /windowsHide: true/);
});

test('stable tunnel repair detects expired project tokens and avoids the PowerShell Replace trap', () => {
  assert.match(unifiedScript, /show \(\[string\]\$Config\.tunnelId\)/);
  assert.match(unifiedScript, /function Test-DevTunnelPort/);
  assert.match(unifiedScript, /port show \(\[string\]\$Config\.tunnelId\)/);
  assert.match(unifiedScript, /Reusing the saved persistent tunnel and host/);
  assert.match(unifiedScript, /Refreshing the persistent tunnel login/);
  assert.match(stableSetup, /login token expired/);
  assert.match(stableSetup, /user', 'login', '-g/);
  assert.match(stableSetup, /Move-Item -LiteralPath \$temporary -Destination \$configPath -Force/);
  assert.doesNotMatch(stableSetup, /\[IO\.File\]::Replace\(\$temporary, \$configPath, \$null\)/);
});

test('expired native tunnel credentials return false so startup can repair instead of aborting', { skip: process.platform !== 'win32' }, async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'umi-tunnel-probe-'));
  const cli = join(temporary, 'expired.cmd');
  try {
    await writeFile(cli, '@echo off\r\necho Login token expired. 1>&2\r\nexit /b 1\r\n');
    const probe = String.raw`
$ErrorActionPreference = 'Stop'
$ast = [System.Management.Automation.Language.Parser]::ParseFile($env:UMI_PROBE_LAUNCHER, [ref]$null, [ref]$null)
$functions = $ast.FindAll({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -in @('Test-DevTunnelLogin','Test-DevTunnelPort') }, $true)
foreach ($definition in $functions) { . ([scriptblock]::Create($definition.Extent.Text)) }
$config = [pscustomobject]@{ tunnelId = 'fixture'; port = 43127 }
if (Test-DevTunnelLogin $env:UMI_PROBE_CLI $config) { throw 'Expired login was accepted.' }
if (Test-DevTunnelPort $env:UMI_PROBE_CLI $config) { throw 'Expired port lookup was accepted.' }
Write-Output 'EXPIRED_PROBES_RETURN_FALSE'
`;
    const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', probe], {
      windowsHide: true, encoding: 'utf8', timeout: 30_000,
      env: { ...process.env, UMI_PROBE_LAUNCHER: fileURLToPath(new URL('../UmiBridge.ps1', import.meta.url)), UMI_PROBE_CLI: cli },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /EXPIRED_PROBES_RETURN_FALSE/);
  } finally { await rm(temporary, { recursive: true, force: true }); }
});

test('admin dashboard separates control surfaces and keeps settings local', () => {
  for (const view of ['overview', 'analytics', 'conversations', 'devices', 'skills', 'requests', 'settings']) {
    assert.match(dashboard, new RegExp(`data-view="${view}"`));
  }
  assert.match(dashboard, /createPairing/);
  assert.match(dashboard, /admin\/api\/devices/);
  assert.match(dashboard, /settingsRefreshInterval/);
  assert.match(dashboard, /settingsReset/);
  assert.match(dashboard, /main>\.view-section\.view-active/);
});
