import assert from 'node:assert/strict';
import test from 'node:test';
import { access, mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCommandSession } from '../scripts/command-session.mjs';

test('prestarted PowerShell reuses one hidden host, captures results and recovers after timeout/exit', { skip: process.platform !== 'win32', timeout: 90_000 }, async () => {
  // Windows runners may expose TEMP through an 8.3 alias; PowerShell returns its long path.
  const folder = await realpath(await mkdtemp(join(tmpdir(), 'umibridge phiên lệnh ')));
  const session = createCommandSession({ cwd: folder });
  const run = async (command, cwd = folder, timeout = 30_000) => session.run(command, cwd, timeout);
  try {
    await session.start();
    const first = await run('$global:UmiSessionMarker = "Đã sẵn sàng"; Write-Output $PID');
    assert.equal(first.exit_code, 0, JSON.stringify(first));
    const pid = Number(first.stdout.trim());
    assert.ok(pid > 0);
    const next = await run('Write-Output ("{0}|{1}" -f $PID, $global:UmiSessionMarker); Write-Output ([System.Diagnostics.Process]::GetCurrentProcess().MainWindowHandle.ToInt64())');
    assert.equal(next.exit_code, 0, JSON.stringify(next));
    assert.match(next.stdout, new RegExp(`${pid}\\|Đã sẵn sàng`));
    assert.match(next.stdout, /(?:^|\r?\n)0\s*$/);
    const paths = await run('Write-Output (Get-Location).Path; [Console]::WriteLine("CONSOLE_STDOUT"); [Console]::Error.WriteLine("CONSOLE_STDERR"); Write-Host "HOST_OUTPUT"');
    assert.equal(paths.exit_code, 0, JSON.stringify(paths));
    assert.ok(paths.stdout.includes(folder), JSON.stringify(paths));
    assert.match(paths.stdout, /CONSOLE_STDOUT/);
    assert.match(paths.stdout, /HOST_OUTPUT/);
    assert.match(paths.stderr, /CONSOLE_STDERR/);
    const native = await run('cmd.exe /d /c "echo NATIVE_STDOUT & echo NATIVE_STDERR 1>&2 & exit /b 7"');
    assert.equal(native.exit_code, 7, JSON.stringify(native));
    assert.match(native.stdout, /NATIVE_STDOUT/);
    assert.match(native.stderr, /NATIVE_STDERR/);
    const failed = await run('throw "EXPECTED_FAILURE"');
    assert.notEqual(failed.exit_code, 0);
    assert.match(failed.stderr, /EXPECTED_FAILURE/);
    assert.equal((await run('Write-Output $PID')).stdout.trim(), String(pid), 'Ordinary errors do not replace the host.');

    await run('$global:UmiCounter = 0');
    const queued = await Promise.all([1, 2, 3].map(() => run('$global:UmiCounter++; Write-Output $global:UmiCounter')));
    assert.deepEqual(queued.map(result => result.stdout.trim()), ['1', '2', '3']);
    const exit = await run('exit 9');
    assert.equal(exit.exit_code, 9, JSON.stringify(exit));
    const recovered = await run('Write-Output $PID; Write-Output AFTER_EXIT');
    assert.equal(recovered.exit_code, 0, JSON.stringify(recovered));
    assert.match(recovered.stdout, /AFTER_EXIT/);
    assert.equal((await run('Write-Output ([bool](Get-Variable UmiSessionMarker -ErrorAction SilentlyContinue))')).stdout.trim(), 'False', 'An explicit exit resets session variables.');

    const forbidden = join(folder, 'late-side-effect.txt').replaceAll("'", "''");
    const timedOut = await run(`Start-Sleep -Seconds 4; [System.IO.File]::WriteAllText('${forbidden}', 'should not run')`, folder, 1000);
    assert.equal(timedOut.timed_out, true, JSON.stringify(timedOut));
    const afterTimeout = await run('Write-Output AFTER_TIMEOUT');
    assert.equal(afterTimeout.exit_code, 0, JSON.stringify(afterTimeout));
    assert.match(afterTimeout.stdout, /AFTER_TIMEOUT/);
    await new Promise(resolve => setTimeout(resolve, 4200));
    await assert.rejects(access(join(folder, 'late-side-effect.txt')), { code: 'ENOENT' });
  } finally {
    await session.close();
    await rm(folder, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
  }
});
