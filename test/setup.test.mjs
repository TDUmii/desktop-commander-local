import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const setup = await readFile(new URL('../Setup-Local.ps1', import.meta.url), 'utf8');
const installer = await readFile(new URL('../Install-UmiBridge.cmd', import.meta.url), 'utf8');
const launcher = await readFile(new URL('../Start-ChatGPT.cmd', import.meta.url), 'utf8');

test('one-click installer bootstraps a verified local runtime and launches the app', () => {
  assert.match(installer, /Setup-Local\.ps1" -Launch/i);
  assert.match(setup, /https:\/\/nodejs\.org\/dist\/index\.json/);
  assert.match(setup, /SHASUMS256\.txt/);
  assert.match(setup, /Get-FileHash.*SHA256/);
  assert.match(setup, /\$npmExe ci --ignore-scripts --no-audit --no-fund/);
  assert.match(setup, /cloudflared-windows-amd64\.exe/);
  assert.match(setup, /Start-Process -FilePath \$startFile/);
  assert.match(launcher, /\.runtime\\node\\node\.exe/);
  assert.match(launcher, /Install-UmiBridge\.cmd/);
});
