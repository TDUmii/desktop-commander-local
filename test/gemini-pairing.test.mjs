import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { startGateway } from '../scripts/local-web-gateway.mjs';
import { checkBrowserConnection } from '../scripts/check-browser-connection.mjs';

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
    const unsupported = method === 'POST' ? 'GET' : method;
    assert.equal((await request(privatePath, { method: unsupported })).status, unsupported === 'GET' ? 406 : 405);
  }
  for (const path of [privatePath + '/', privatePath.replace('/gemini/', '/Gemini/'), privatePath + '/admin', '/gemini/mcp']) {
    assert.equal((await request(path, { method: 'POST' })).status, 404, 'Pairing must not accept path aliases or admin access.');
  }
  assert.equal((await request('/admin', { headers: { Host: 'paired-test.example' } })).status, 404);
  assert.equal((await request('/admin/api/requests', { headers: { Host: 'paired-test.example' } })).status, 404);
  const cors = { Origin: 'https://gemini.google.com', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,mcp-protocol-version' };
  const preflight = await request(privatePath, { method: 'OPTIONS', headers: cors });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), cors.Origin);
  const extensionOrigin = 'chrome-extension://kngiafgkdnlkgmefdafaibkibegkcaef';
  const extensionPreflight = await request(privatePath, { method: 'OPTIONS', headers: { ...cors, Origin: extensionOrigin } });
  assert.equal(extensionPreflight.status, 204);
  assert.equal(extensionPreflight.headers.get('access-control-allow-origin'), extensionOrigin);
  assert.equal((await request(privatePath, { method: 'OPTIONS', headers: { ...cors, Origin: 'chrome-extension://untrusted-extension' } })).status, 403);
  await writeFile(join(temporary, 'web-status.json'), JSON.stringify({ port: gateway.port }));
  await writeFile(join(temporary, 'gemini-pairing-secret.txt'), secret);
  assert.equal(await checkBrowserConnection(temporary), 11);
  await writeFile(join(temporary, 'gemini-pairing-secret.txt'), randomBytes(32).toString('base64url'));
  await assert.rejects(checkBrowserConnection(temporary), 'A stale setup credential must fail before opening Gemini.');
  assert.equal((await request(privatePath, { method: 'OPTIONS', headers: { ...cors, 'Access-Control-Request-Method': 'GET' } })).status, 204);
  assert.equal((await request(privatePath, { method: 'OPTIONS', headers: { ...cors, Origin: 'https://untrusted.example' } })).status, 403);
  assert.equal((await request(privatePath, { method: 'OPTIONS', headers: { ...cors, 'Access-Control-Request-Headers': 'x-local-admin' } })).status, 403);
  assert.equal((await request(privatePath, { method: 'OPTIONS', headers: { ...cors, 'Access-Control-Request-Method': 'DELETE' } })).status, 403);
  for (const path of ['/admin', '/admin/api/requests', '/mcp', privatePath.replace(secret, randomBytes(32).toString('base64url'))]) {
    assert.equal((await request(path, { method: 'OPTIONS', headers: cors })).headers.get('access-control-allow-origin'), null);
  }
  const stream = await request(privatePath, { headers: { Origin: cors.Origin, Accept: 'text/event-stream' }, signal: AbortSignal.timeout(5000) });
  assert.equal(stream.status, 200);
  assert.match(stream.headers.get('content-type'), /text\/event-stream/);
  await stream.body.cancel();
  const contentTypes = [];
  const transport = new StreamableHTTPClientTransport(new URL(privatePath, origin), {
    requestInit: { headers: { Origin: cors.Origin, 'x-provider': 'chatgpt', 'x-client-name': 'Spoofed app' } },
    fetch: async (...args) => { const response = await fetch(...args); contentTypes.push(response.headers.get('content-type')); return response; },
  });
  client = new Client({ name: 'ChatGPT spoofed initialization metadata', version: '1.0.0' });
  await client.connect(transport);
  const tools = await client.listTools();
  assert.ok(contentTypes.some(value => value?.includes('text/event-stream')), 'Paired responses use streaming SSE without changing the OAuth endpoint.');
  assert.ok(tools.tools.some(tool => tool.name === 'read_file'));
  const filePath = join(temporary, 'read-only-proof.txt');
  await writeFile(filePath, 'GEMINI_PAIRING_TEST_OK');
  const result = await client.callTool({ name: 'read_file', arguments: { path: filePath }, _meta: { clientName: 'ChatGPT', provider: 'chatgpt' } });
  assert.ok(!result.isError);
  assert.ok(result.content.some(block => block.text?.includes('GEMINI_PAIRING_TEST_OK')));
  const browserFile = join(temporary, 'browser-write-proof.txt');
  const written = await client.callTool({ name: 'write_file', arguments: { path: browserFile, content: 'BROWSER_MCP_WRITE_OK' } });
  assert.ok(!written.isError);
  assert.equal(await readFile(browserFile, 'utf8'), 'BROWSER_MCP_WRITE_OK');
  const command = await client.callTool({ name: 'run_command', arguments: { command: 'echo BROWSER_MCP_COMMAND_OK', cwd: temporary } });
  assert.ok(!command.isError);
  assert.ok(command.content.some(block => block.text?.includes('BROWSER_MCP_COMMAND_OK')));
  const payload = await (await request('/admin/api/requests', { headers: { 'x-local-admin': '1' } })).json();
  assert.equal(payload.requests[0].clientName, 'Gemini (paired URL)', 'Only the internal authenticated route marker determines the paired label.');
  assert.equal(payload.requests[0].provider, 'gemini');
  assert.ok(!(await readFile(join(temporary, 'request-history.jsonl'), 'utf8')).includes(secret), 'The capability must not be saved in request history.');
  const savedPort = gateway.port;
  await gateway.close();
  gateway = await startGateway({ ...settings, port: savedPort, geminiPairingSecret: secret });
  const afterRestart = await client.callTool({ name: 'read_file', arguments: { path: browserFile } });
  assert.ok(afterRestart.content.some(block => block.text?.includes('BROWSER_MCP_WRITE_OK')), 'An existing stateless client can call tools after a same-address restart.');
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
