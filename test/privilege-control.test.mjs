import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createPrivilegeControl } from '../scripts/privilege-control.mjs';

const normal = { mode: 'normal', elevated: false, installed: false, capability: 'available', running: true };
function fixture(status = normal) {
  const calls = [];
  const spawnProcess = (command, args, options) => {
    const child = new EventEmitter();
    child.stdout = new PassThrough(); child.unref = () => {}; child.kill = () => {};
    calls.push({ command, args, options, child });
    if (args[args.indexOf('-Action') + 1] === 'status') queueMicrotask(() => {
      child.stdout.end(JSON.stringify(status)); child.emit('close', 0);
    });
    return child;
  };
  return { calls, control: createPrivilegeControl({ root: 'D:\\UmiBridge', enabled: true, spawnProcess }) };
}

test('privilege status filters private metadata and corrupt native output', async () => {
  const { control } = fixture({ ...normal, account: 'PRIVATE', path: 'PRIVATE', version: 'PRIVATE/path' });
  assert.deepEqual(await control.status(), { ...normal, pending: false });
  const invalid = fixture({ ...normal, mode: 'SYSTEM', capability: 'available' });
  assert.equal((await invalid.control.status()).capability, 'unavailable');
});

test('privilege mode accepts no password, code, path or executable from web', async () => {
  const { control, calls } = fixture();
  for (const value of [null, {}, { mode: 'system' }, { mode: 'admin', password: 'x' }, { mode: 'admin', SourceRoot: 'C:\\Windows' }]) {
    await assert.rejects(control.change(value), { status: 400 });
  }
  assert.equal(calls.length, 0);
  assert.equal((await createPrivilegeControl({ root: '.', enabled: false }).status()).capability, 'unavailable');
});

test('concurrent privilege changes create one hidden native consent operation', async () => {
  const { control, calls } = fixture();
  const results = await Promise.allSettled([control.change({ mode: 'admin' }), control.change({ mode: 'admin' })]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.find(result => result.status === 'rejected').reason.status, 409);
  const mutations = calls.filter(call => call.args[call.args.indexOf('-Action') + 1] !== 'status');
  assert.equal(mutations.length, 1);
  assert.equal(mutations[0].options.windowsHide, true);
  assert.notEqual(mutations[0].options.detached, true);
  assert.equal(mutations[0].options.stdio, 'ignore');
  assert.ok(mutations[0].args.includes('-GatewayRequest'), 'Native consent must leave the gateway process tree before restarting it.');
  assert.equal((await control.status()).pending, true);
  mutations[0].child.emit('close', 1223);
  assert.equal((await control.status()).error, 'uac_cancelled');
  assert.equal((await control.status()).pending, false);
});

test('native Windows PowerShell executes the mode helper and preserves its failure exit code', { skip: process.platform !== 'win32' }, async () => {
  const temporary = resolve(tmpdir());
  const root = await mkdtemp(join(temporary, 'UmiBridge privilege '));
  assert.ok(root.startsWith(temporary + sep));
  try {
    await mkdir(join(root, 'scripts', 'windows'), { recursive: true });
    await writeFile(join(root, 'scripts', 'windows', 'Admin-Mode.ps1'), `param([string]$Action,[string]$SourceRoot,[switch]$GatewayRequest)
if($Action -eq 'status'){'{"mode":"normal","elevated":false,"installed":false,"capability":"available","running":true}';exit 0}
[IO.File]::WriteAllText((Join-Path $SourceRoot 'invoked.json'),(@{action=$Action;root=$SourceRoot;gateway=[bool]$GatewayRequest}|ConvertTo-Json -Compress))
exit 7
`);
    let completion;
    const control = createPrivilegeControl({ root, enabled: true, spawnProcess(shell, args, options) {
      const child = spawn(shell, args, options);
      if (args[args.indexOf('-Action') + 1] !== 'status') completion = new Promise((resolve, reject) => {
        child.once('error', reject); child.once('close', resolve);
      });
      return child;
    } });
    const keepAlive = setInterval(() => {}, 1000);
    try {
      assert.equal((await control.change({ mode: 'admin' })).pending, true);
      assert.equal(await completion, 7);
      assert.deepEqual(JSON.parse(await readFile(join(root, 'invoked.json'), 'utf8')), { action: 'enable', root, gateway: true });
      assert.equal((await control.status()).error, 'privilege_failed');
    } finally { clearInterval(keepAlive); }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('already selected mode is idempotent and native integrity failure cannot trigger UAC', async () => {
  const ready = fixture();
  assert.equal((await ready.control.change({ mode: 'normal' })).pending, false);
  assert.equal(ready.calls.length, 1);
  const broken = fixture({ ...normal, capability: 'integrity-error' });
  await assert.rejects(broken.control.change({ mode: 'admin' }), { status: 409 });
  assert.equal(broken.calls.length, 1);
  const externalConsent = fixture({ ...normal, pending: true });
  await assert.rejects(externalConsent.control.change({ mode: 'admin' }), { status: 409 });
  assert.equal(externalConsent.calls.length, 1, 'A fresh gateway cannot duplicate an existing native consent operation.');
});

test('saved Admin mode resumes a Normal gateway instead of accepting an inactive task as complete', async () => {
  const { control, calls } = fixture({ ...normal, mode: 'admin', installed: true, running: false });
  assert.equal((await control.change({ mode: 'admin' })).pending, true);
  assert.equal(calls[1].args[calls[1].args.indexOf('-Action') + 1], 'enable');
  calls[1].child.emit('close', 0);
  const active = fixture({ ...normal, mode: 'admin', installed: true, running: true, elevated: true });
  assert.equal((await active.control.change({ mode: 'admin' })).pending, false);
  assert.equal(active.calls.length, 1);
  const unmanaged = fixture({ ...normal, elevated: true });
  await assert.rejects(unmanaged.control.change({ mode: 'normal' }), { status: 409 });
  assert.equal(unmanaged.calls.length, 1, 'Unmanaged elevated processes cannot be downgraded by a saved-mode toggle.');
});
