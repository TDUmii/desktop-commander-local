import assert from 'node:assert/strict';
import test from 'node:test';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, cp, symlink, readFile, writeFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

test('local browser launcher needs no tunnel and preserves the saved OAuth issuer', { timeout: 45000 }, async () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const folder = await mkdtemp(join(tmpdir(), 'umibridge-local-browser-'));
  const stateDir = join(folder, '.local-data');
  let processHandle, client;
  try {
    await cp(join(root, 'scripts'), join(folder, 'scripts'), { recursive: true });
    await symlink(resolve(root, 'node_modules'), join(folder, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    await mkdir(stateDir);
    const oauth = JSON.stringify({ version: 1, issuer: 'https://saved-issuer.example/', clients: [], access: [], refresh: [] });
    await writeFile(join(stateDir, 'oauth-state.json'), oauth);
    const key = randomBytes(32).toString('base64url');
    await writeFile(join(stateDir, 'gemini-pairing-secret.txt'), key);
    // Local mode must not attempt to read a tunnel config or run an unavailable tunnel binary.
    await writeFile(join(stateDir, 'tunnel-config.json'), 'invalid tunnel config');
    const reservation = createServer();
    await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
    const port = reservation.address().port;
    await new Promise(resolve => reservation.close(resolve));
    processHandle = spawn(process.execPath, [join(folder, 'scripts/run-local-web.mjs')], {
      cwd: folder, env: { ...process.env, DC_LOCAL_ONLY: '1', DC_WEB_PORT: String(port), DC_PUBLIC_URL: '' },
      windowsHide: true, stdio: 'ignore',
    });
    let status;
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline && processHandle.exitCode === null) {
      try { status = JSON.parse(await readFile(join(stateDir, 'web-status.json'), 'utf8')); break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(status, 'Local launcher must become ready without a tunnel.');
    assert.equal(status.tunnelProvider, 'local');
    assert.equal(status.tunnelPid, undefined);
    assert.equal(status.publicUrl, 'https://saved-issuer.example/');
    assert.equal(await readFile(join(stateDir, 'oauth-state.json'), 'utf8'), oauth);
    const local = `http://127.0.0.1:${port}`;
    assert.equal((await fetch(local + '/admin')).status, 200);
    const remoteStatus = await new Promise((resolve, reject) => {
      const request = httpRequest(local + '/admin', { headers: { Host: 'saved-issuer.example' } }, response => { response.resume(); resolve(response.statusCode); });
      request.on('error', reject); request.end();
    });
    assert.equal(remoteStatus, 404);
    client = new Client({ name: 'local-browser-regression', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL(`/gemini/${key}/mcp`, local), {
      requestInit: { headers: { Origin: 'https://gemini.google.com' } },
    }));
    assert.equal((await client.listTools()).tools.length, 23);
    const proof = join(folder, 'proof.txt');
    await writeFile(proof, 'LOCAL_BROWSER_LAUNCHER_OK');
    const result = await client.callTool({ name: 'read_file', arguments: { path: proof } });
    assert.ok(result.content.some(block => block.text?.includes('LOCAL_BROWSER_LAUNCHER_OK')));
  } finally {
    await client?.close().catch(() => {});
    if (processHandle && processHandle.exitCode === null) {
      if (process.platform === 'win32') {
        try { execFileSync('taskkill.exe', ['/PID', String(processHandle.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); }
        catch (error) {
          // taskkill may race the gateway shutdown (128 or 255); only ignore a verified exit.
          await new Promise(resolve => {
            if (processHandle.exitCode !== null || processHandle.signalCode !== null) return resolve();
            const timer = setTimeout(resolve, 1000);
            processHandle.once('exit', () => { clearTimeout(timer); resolve(); });
          });
          if (processHandle.exitCode === null && processHandle.signalCode === null) throw error;
        }
      } else processHandle.kill('SIGTERM');
      if (processHandle.exitCode === null && processHandle.signalCode === null) await new Promise(resolve => processHandle.once('exit', resolve));
    }
    await rm(folder, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});
