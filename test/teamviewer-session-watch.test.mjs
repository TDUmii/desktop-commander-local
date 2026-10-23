import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const file = fileURLToPath(new URL('../scripts/windows/Keep-TeamViewer-Visible.ps1', import.meta.url));
const run = (...args) => spawnSync('powershell.exe', [
  '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
  '-File', file, '-Once', '-DryRun', ...args,
], { encoding: 'utf8', windowsHide: true, timeout: 15_000 });
const options = { skip: process.platform !== 'win32', timeout: 20_000 };

test('TeamViewer manager cannot be selected for always-on-top', options, () => {
  const result = run('-SessionTitle', 'TeamViewer');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must identify a remote TeamViewer session/);
});

test('absent remote session never pins the management window', options, () => {
  const result = run('-SessionTitle', 'NO-SUCH-REMOTE-SESSION - TeamViewer');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /No TeamViewer process|Remote session not found/);
  assert.doesNotMatch(result.stdout, /Pinned remote session|would refresh remote session/);
});
