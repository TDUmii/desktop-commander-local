import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { startGateway } from '../scripts/local-web-gateway.mjs';

const temporary = await mkdtemp(join(tmpdir(), 'umibridge-gemini-pairing-'));
const secret = randomBytes(32).toString('base64url');
const connectionSecret = randomBytes(32).toString('base64url');
const settings = { port: 0, publicUrl: 'https://paired-test.example', connectionSecret, configDir: join(temporary, 'profile') };
const privatePath = `/gemini/${secret}/mcp`;
let gateway, client;
try {
  await assert.rejects(startGateway({ ...settings, geminiPairingSecret: 'too-short' }), /32 random bytes/);
  gateway = await startGateway({ ...settings, geminiPairingSecret: secret });
  let origin = `http://127.0.0.1:${gateway.port}`;
  const request = (path, options) => fetch(`${origin}${path}`, options);
  for (const method of ['GET', 'POST', 'DELETE']) {
    assert.equal((await request('/mcp', { method })).status, 401, 'The existing endpoint still requires OAuth.');
    assert.equal((await request(`/gemini/${randomBytes(32).toString('base64url')}/mcp`, { method })).status, 404);
    assert.equal((await request(privatePath, { method: method === 'POST' ? 'GET' : method })).status, 405);
  }
  for (const path of [privatePath + '/', privatePath.replace('/gemini/', '/Gemini/'), privatePath + '/admin', '/gemini/mcp']) {
    assert.equal((await request(path, { method: 'POST' })).status, 404, 'Pairing must not accept path aliases or admin access.');
  }
  assert.equal((await request('/admin', { headers: { Host: 'paired-test.example' } })).status, 404);
  assert.equal((await request('/admin/api/requests', { headers: { Host: 'paired-test.example' } })).status, 404);
  const transport = new StreamableHTTPClientTransport(new URL(privatePath, origin), {
    requestInit: { headers: { 'x-provider': 'chatgpt', 'x-client-name': 'Spoofed app' } },
  });
  client = new Client({ name: 'ChatGPT spoofed initialization metadata', version: '1.0.0' });
  await client.connect(transport);
  const tools = await client.listTools();
  assert.ok(tools.tools.some(tool => tool.name === 'read_file'));
  const filePath = join(temporary, 'read-only-proof.txt');
  await writeFile(filePath, 'GEMINI_PAIRING_TEST_OK');
  const result = await client.callTool({ name: 'read_file', arguments: { path: filePath }, _meta: { clientName: 'ChatGPT', provider: 'chatgpt' } });
  assert.ok(!result.isError);
  assert.ok(result.content.some(block => block.text?.includes('GEMINI_PAIRING_TEST_OK')));
  const payload = await (await request('/admin/api/requests', { headers: { 'x-local-admin': '1' } })).json();
  assert.equal(payload.requests[0].clientName, 'Gemini (paired URL)', 'Only the internal authenticated route marker determines the paired label.');
  assert.equal(payload.requests[0].provider, 'gemini');
  assert.ok(!(await readFile(join(temporary, 'request-history.jsonl'), 'utf8')).includes(secret), 'The capability must not be saved in request history.');
  await client.close(); client = undefined;
  await gateway.close();
  gateway = await startGateway({ ...settings, geminiPairingSecret: randomBytes(32).toString('base64url') });
  origin = `http://127.0.0.1:${gateway.port}`;
  assert.equal((await request(privatePath, { method: 'POST' })).status, 404, 'Rotating the credential invalidates the old URL.');
  await gateway.close();
  gateway = await startGateway(settings);
  origin = `http://127.0.0.1:${gateway.port}`;
  assert.equal((await request(privatePath, { method: 'POST' })).status, 404, 'Pairing is disabled when its credential is absent.');
  console.log('PASS: opt-in Gemini paired URL, exact-route authorization, tool calls, OAuth/admin isolation, trusted history label and credential rotation.');
} finally {
  await client?.close().catch(() => {});
  await gateway?.close();
  await rm(temporary, { recursive: true, force: true });
}
