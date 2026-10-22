import assert from 'node:assert/strict';
import test from 'node:test';
import { appendFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { startGateway } from '../scripts/local-web-gateway.mjs';

test('MCP continues beyond 500 calls; totals survive restart independently of retained history', { timeout: 60_000 }, async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'umibridge-volume-'));
  const pairingSecret = randomBytes(32).toString('base64url');
  const settings = { port: 0, publicUrl: 'https://volume-test.example', connectionSecret: randomBytes(32).toString('base64url'), geminiPairingSecret: pairingSecret, configDir: join(temporary, 'profile') };
  const filePath = join(temporary, 'fixture.txt');
  const marker = randomBytes(16).toString('hex');
  await writeFile(filePath, marker);
  const adminHeaders = { 'x-local-admin': '1' };
  let gateway, client;
  try {
    gateway = await startGateway(settings);
    const port = gateway.port;
    const origin = `http://127.0.0.1:${port}`;
    const history = async () => {
      const response = await fetch(`${origin}/admin/api/requests`, { headers: adminHeaders });
      assert.equal(response.status, 200);
      return response.json();
    };
    client = new Client({ name: 'volume-test', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL(`/gemini/${pairingSecret}/mcp`, origin)));
    // Use real stdio file reads through authenticated HTTP, not synthetic history entries.
    for (let index = 0; index < 525; index++) {
      const result = await client.callTool({ name: 'read_file', arguments: { path: filePath, length: 1 } });
      assert.ok(!result.isError, `MCP call ${index + 1} failed.`);
      assert.equal(JSON.parse(result.content[0].text).text, marker);
    }
    let payload = await history();
    assert.equal(payload.stats.total, 500, 'Rolling history stays bounded.');
    assert.equal(payload.stats.historyLimit, 500);
    assert.deepEqual(payload.stats.received, { total: 525, success: 525, errors: 0 });
    assert.equal((await readFile(join(temporary, 'request-history.jsonl'), 'utf8')).trim().split('\n').length, 525);
    assert.equal((await fetch(`${origin}/health`)).status, 200);

    const proofPath = join(temporary, 'after-limit.txt');
    const written = await client.callTool({ name: 'write_file', arguments: { path: proofPath, content: 'AFTER_500_OK' } });
    assert.ok(!written.isError);
    assert.equal(await readFile(proofPath, 'utf8'), 'AFTER_500_OK');
    const command = await client.callTool({ name: 'run_command', arguments: { command: 'echo AFTER_500_COMMAND_OK', cwd: temporary, timeout_ms: 5000 } });
    assert.ok(!command.isError);
    const output = JSON.parse(command.content[0].text);
    assert.equal(output.exit_code, 0);
    assert.match(output.stdout, /AFTER_500_COMMAND_OK/);

    await gateway.close();
    // An interrupted journal line must not change the recovered counter.
    await appendFile(join(temporary, 'request-history.jsonl'), 'incomplete journal line\n');
    gateway = await startGateway({ ...settings, port });
    payload = await history();
    assert.deepEqual(payload.stats.received, { total: 527, success: 527, errors: 0 });
    assert.equal(payload.stats.total, 500);
    const failed = await client.callTool({ name: 'read_file', arguments: { path: join(temporary, 'does-not-exist.txt') } });
    assert.equal(failed.isError, true);
    const afterRestart = await client.callTool({ name: 'read_file', arguments: { path: proofPath } });
    assert.ok(!afterRestart.isError);
    assert.equal(JSON.parse(afterRestart.content[0].text).text, 'AFTER_500_OK');
    assert.deepEqual((await history()).stats.received, { total: 529, success: 528, errors: 1 });

    const cleared = await fetch(`${origin}/admin/api/clear`, { method: 'POST', headers: adminHeaders });
    assert.equal(cleared.status, 200);
    assert.deepEqual((await history()).stats.received, { total: 0, success: 0, errors: 0 });
    await gateway.close();
    gateway = await startGateway({ ...settings, port });
    assert.equal((await history()).stats.received.total, 0, 'Clear stays reset after restart.');
  } finally {
    await client?.close().catch(() => {});
    await gateway?.close();
    await rm(temporary, { recursive: true, force: true });
  }
});
