import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const setup = await readFile(new URL('../Setup-Local.ps1', import.meta.url), 'utf8');
const installer = await readFile(new URL('../Install-UmiBridge.cmd', import.meta.url), 'utf8');
const launcher = await readFile(new URL('../Start-ChatGPT.cmd', import.meta.url), 'utf8');
const unifiedLauncher = await readFile(new URL('../UmiBridge.cmd', import.meta.url), 'utf8');
const unifiedScript = await readFile(new URL('../UmiBridge.ps1', import.meta.url), 'utf8');
const webLauncher = await readFile(new URL('../scripts/run-local-web.mjs', import.meta.url), 'utf8');

test('one-click installer bootstraps a verified local runtime and launches the app', () => {
  assert.match(installer, /UmiBridge\.cmd/i);
  assert.match(setup, /https:\/\/nodejs\.org\/dist\/index\.json/);
  assert.match(setup, /SHASUMS256\.txt/);
  assert.match(setup, /Get-FileHash.*SHA256/);
  assert.match(setup, /\$npmExe ci --ignore-scripts --no-audit --no-fund/);
  assert.match(setup, /cloudflared-windows-amd64\.exe/);
  assert.match(setup, /Start-Process -FilePath \$startFile/);
  assert.match(launcher, /\.runtime\\node\\node\.exe/);
  assert.match(launcher, /Install-UmiBridge\.cmd/);
});

test('unified launcher repairs, updates, hosts and starts one shared ChatGPT/Gemini gateway', () => {
  assert.match(unifiedLauncher, /UmiBridge\.ps1/i);
  assert.match(unifiedScript, /git.Source fetch/);
  assert.match(unifiedScript, /Setup-Local\.ps1/);
  assert.match(unifiedScript, /Setup-Stable-Connection\.ps1/);
  assert.match(unifiedScript, /Start-UmiBridge\.ps1/);
  assert.match(unifiedScript, /Test-DevTunnelLogin/);
  assert.match(unifiedScript, /DC_DISABLE_SAVED_TUNNEL/);
  assert.match(unifiedScript, /Quick Tunnel/);
  assert.match(webLauncher, /DC_DISABLE_SAVED_TUNNEL === '1'/);
  assert.match(unifiedScript, /ChatGPT and Gemini share this gateway/i);
});
