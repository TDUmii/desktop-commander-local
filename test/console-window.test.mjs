import assert from 'node:assert/strict';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { createCommandSession } from '../scripts/command-session.mjs';

test('command host and Start-Process children do not show console or Windows Terminal windows', { skip: process.platform !== 'win32', timeout: 90_000 }, async () => {
  const observer = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', fileURLToPath(new URL('./helpers/console-observer.ps1', import.meta.url))], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  const closed = new Promise(resolve => observer.once('close', resolve));
  const session = createCommandSession();
  let observed, diagnostics = '';
  observer.stderr.on('data', chunk => { diagnostics = (diagnostics + chunk).slice(-4000); });
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Console observer startup timed out: ${diagnostics}`)), 30_000);
    const lines = createInterface({ input: observer.stdout });
    lines.on('line', line => {
      if (line === 'READY') { clearTimeout(timer); resolve(); }
      else { try { observed = JSON.parse(line); } catch {} }
    });
    observer.once('error', error => { clearTimeout(timer); reject(error); });
    observer.once('close', () => { clearTimeout(timer); reject(new Error(`Console observer stopped: ${diagnostics}`)); });
  });
  try {
    await ready;
    await session.start();
    const commands = [
      'cmd.exe /d /c "ping -n 2 127.0.0.1 >nul & echo DIRECT_OK"',
      "$p = Start-Process -FilePath cmd.exe -ArgumentList '/d /c ping -n 2 127.0.0.1' -Wait -PassThru; Write-Output ('START_EXIT=' + $p.ExitCode)",
      "$p = saps powershell.exe -ArgumentList '-NoProfile -NonInteractive -Command Start-Sleep -Milliseconds 500' -Wait -PassThru; Write-Output ('ALIAS_EXIT=' + $p.ExitCode)",
      "$p = Start-Process cmd.exe -ArgumentList '/d /c exit 0' -NoNewWindow -Wait -PassThru; Write-Output ('SAME_WINDOW_EXIT=' + $p.ExitCode)",
    ];
    for (const command of commands) {
      const result = await session.run(command, undefined, 30_000);
      assert.equal(result.exit_code, 0, JSON.stringify(result));
      assert.match(result.stdout, /DIRECT_OK|(?:START|ALIAS|SAME_WINDOW)_EXIT=0/);
    }
  } finally {
    await session.close();
    observer.stdin.end('STOP\n');
    await closed;
  }
  assert.deepEqual(observed, [], 'No new visible console/Windows Terminal window should be shown, including transient SHOW events.');
});
