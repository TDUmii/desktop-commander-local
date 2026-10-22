import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const setup = await readFile(new URL('../Setup-Local.ps1', import.meta.url), 'utf8');
const launcher = await readFile(new URL('../Start-ChatGPT.cmd', import.meta.url), 'utf8');
const compatibilityLauncher = await readFile(new URL('../Start-UmiBridge.cmd', import.meta.url), 'utf8');
const unifiedLauncher = await readFile(new URL('../UmiBridge.cmd', import.meta.url), 'utf8');
const unifiedScript = await readFile(new URL('../UmiBridge.ps1', import.meta.url), 'utf8');
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
  assert.match(unifiedScript, /Quick Tunnel/);
  assert.match(unifiedScript, /Watch-Requests/);
  assert.match(webLauncher, /DC_DISABLE_SAVED_TUNNEL === '1'/);
  assert.match(unifiedScript, /ChatGPT and Gemini share this gateway/i);
});

test('admin dashboard separates control surfaces and keeps settings local', () => {
  for (const view of ['overview', 'analytics', 'conversations', 'skills', 'requests', 'settings']) {
    assert.match(dashboard, new RegExp(`data-view="${view}"`));
  }
  assert.match(dashboard, /settingsRefreshInterval/);
  assert.match(dashboard, /settingsReset/);
  assert.match(dashboard, /main>\.view-section\.view-active/);
});
