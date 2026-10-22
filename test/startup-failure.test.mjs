import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, copyFile, writeFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('launcher detects a dead tunnel process without waiting the full startup timeout or disclosing logs', { skip: process.platform !== 'win32' }, async () => {
  const folder=await mkdtemp(join(tmpdir(),'umi-startup-failure-'));
  const reservation=createServer();
  await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));
  const port=reservation.address().port;
  await new Promise(resolve=>reservation.close(resolve));
  try {
    await mkdir(join(folder,'.runtime','node'),{recursive:true});
    await mkdir(join(folder,'scripts','windows'),{recursive:true});
    await copyFile(process.execPath,join(folder,'.runtime','node','node.exe'));
    await copyFile(new URL('../scripts/windows/Start-UmiBridge.ps1',import.meta.url),join(folder,'scripts','windows','Start-UmiBridge.ps1'));
    await writeFile(join(folder,'scripts','run-local-web.mjs'),"console.error('Unable to start UmiBridge: Tunnel exited (3). PRIVATE_DIAGNOSTIC_FIXTURE');process.exit(3);\n");
    const started=Date.now();
    const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',join(folder,'scripts','windows','Start-UmiBridge.ps1')],{windowsHide:true,encoding:'utf8',timeout:25_000,env:{...process.env,DC_WEB_PORT:String(port)}});
    assert.notEqual(result.status,0);
    assert.ok(Date.now()-started<25_000,'An exited gateway must not leave the launcher silently waiting for 60 attempts.');
    assert.match(result.stderr,/TUNNEL_START_FAILED/);
    assert.doesNotMatch(result.stderr,/PRIVATE_DIAGNOSTIC_FIXTURE/,'Raw private log text must not be printed.');
  } finally {
    await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  }
});
