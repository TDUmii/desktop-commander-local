import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { randomBytes, createHash } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { startGateway } from '../scripts/local-web-gateway.mjs';

const temporary = await mkdtemp(join(tmpdir(), 'dc-local-web-test-'));
const freePort = createServer();
await new Promise(resolve => freePort.listen(0, '127.0.0.1', resolve));
const port = freePort.address().port;
await new Promise(resolve => freePort.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const secret = randomBytes(32).toString('base64url');
let gateway, client;
try {
  await assert.rejects(startGateway({ publicUrl: origin, configDir: temporary, connectionSecret: '' }), /connectionSecret/);
  await assert.rejects(startGateway({ publicUrl: 'http://example.com', configDir: temporary, connectionSecret: secret }), /HTTPS/);
  gateway = await startGateway({ port, publicUrl: origin, connectionSecret: secret, configDir: join(temporary, 'profile') });
  const request = (path, options) => fetch(`${origin}${path}`, { redirect: 'manual', ...options });
  const form = (path, data, headers = {}) => request(path, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers }, body: new URLSearchParams(data) });
  const register = data => request('/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const registration = { client_name: 'Kiểm tra <script>', redirect_uris: ['https://chatgpt.com/connector_platform/oauth/callback'], token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'] };

  assert.deepEqual(await (await request('/health')).json(), { ok: true });
  const metadata = await (await request('/.well-known/oauth-authorization-server')).json();
  const protectedMetadata = await (await request('/.well-known/oauth-protected-resource/mcp')).json();
  assert.equal(metadata.issuer, `${origin}/`);
  assert.equal(metadata.registration_endpoint, `${origin}/register`);
  assert.deepEqual(metadata.code_challenge_methods_supported, ['S256']);
  assert.deepEqual(metadata.scopes_supported, ['desktop', 'offline_access']);
  assert.equal(protectedMetadata.resource, `${origin}/mcp`);
  assert.deepEqual(protectedMetadata.authorization_servers, [`${origin}/`]);
  for (const method of ['GET', 'POST', 'DELETE']) {
    const unauthorized = await request('/mcp', { method });
    assert.equal(unauthorized.status, 401);
    assert.match(unauthorized.headers.get('www-authenticate'), /oauth-protected-resource\/mcp/);
  }
  assert.equal((await register({ ...registration, redirect_uris: ['http://example.com/callback'] })).status, 400);
  assert.equal((await register({ ...registration, redirect_uris: ['https://user:password@example.com/callback'] })).status, 400);
  const registeredResponse = await register(registration);
  assert.equal(registeredResponse.status, 201);
  const registered = await registeredResponse.json();
  const verifier = randomBytes(32).toString('base64url');
  const params = { response_type: 'code', client_id: registered.client_id, redirect_uri: registration.redirect_uris[0], code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', state: 'regression-state', resource: `${origin}/mcp`, scope: 'desktop offline_access' };
  const denied = await request(`/authorize?${new URLSearchParams({ ...params, resource: 'https://another.example/mcp' })}`);
  assert.equal(denied.status, 302);
  assert.equal(new URL(denied.headers.get('location')).searchParams.get('error'), 'invalid_target');
  const authorization = await request(`/authorize?${new URLSearchParams(params)}`);
  assert.equal(authorization.status, 200);
  assert.equal(authorization.headers.get('referrer-policy'), 'same-origin', 'Consent forms must retain a same-origin Origin header in browsers');
  assert.match(authorization.headers.get('content-security-policy'), /form-action 'self' https:\/\/chatgpt.com/);
  const cookie = authorization.headers.get('set-cookie').split(';')[0];
  const html = await authorization.text();
  assert.ok(!html.includes(secret));
  assert.ok(!html.includes('Kiểm tra <script>'));
  assert.ok(html.includes('Kiểm tra &lt;script&gt;'));
  const requestId = html.match(/name="requestId" value="([^"]+)"/)[1];
  assert.equal((await form('/consent', { requestId, secret })).status, 400);
  assert.equal((await form('/consent', { requestId, secret }, { Cookie: cookie, Origin: 'https://attacker.example' })).status, 400);
  assert.equal((await form('/consent', { requestId, secret: 'incorrect' }, { Cookie: cookie, Origin: origin })).status, 401);
  const consent = await form('/consent', { requestId, secret }, { Cookie: cookie, Origin: origin });
  assert.equal(consent.status, 302);
  const callback = new URL(consent.headers.get('location'));
  assert.equal(callback.origin, 'https://chatgpt.com');
  assert.equal(callback.searchParams.get('state'), 'regression-state');
  const code = callback.searchParams.get('code');
  assert.ok(code);
  const tokenParams = { grant_type: 'authorization_code', client_id: registered.client_id, code, code_verifier: verifier, redirect_uri: registration.redirect_uris[0], resource: `${origin}/mcp` };
  const wrongPkce = await form('/token', { ...tokenParams, code_verifier: randomBytes(32).toString('base64url') });
  assert.equal(wrongPkce.status, 400);
  assert.equal((await wrongPkce.json()).error, 'invalid_grant');
  const exchange = await form('/token', tokenParams);
  assert.equal(exchange.status, 200);
  const tokens = await exchange.json();
  assert.equal(tokens.token_type, 'Bearer');
  assert.equal(tokens.expires_in, 900);
  assert.equal(tokens.scope, 'desktop offline_access');
  assert.ok(tokens.refresh_token);
  assert.equal((await form('/token', tokenParams)).status, 400, 'Authorization codes must be single-use');

  const transport = new StreamableHTTPClientTransport(new URL(`${origin}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${tokens.access_token}` } } });
  client = new Client({ name: 'local-web-regression', version: '1.0.0' });
  await client.connect(transport);
  const listed = await client.listTools();
  assert.ok(listed.tools.length >= 11);
  assert.ok(listed.tools.find(tool => tool.name === 'list_skills'));
  assert.ok(listed.tools.find(tool => tool.name === 'read_skill'));
  for (const name of ['read_file', 'write_file', 'run_command']) {
    const tool = listed.tools.find(tool => tool.name === name);
    assert.ok(tool, `Missing upstream tool: ${name}`);
    assert.equal(tool.inputSchema.type, 'object');
  }
  const file = join(temporary, 'hello-vietnamese.txt');
  const content = 'Xin chào từ MCP HTTP local.\nDữ liệu kiểm tra riêng.\n';
  const written = await client.callTool({ name: 'write_file', arguments: { path: file, content } });
  assert.ok(!written.isError, JSON.stringify(written));
  assert.equal(await readFile(file, 'utf8'), content);
  const read = await client.callTool({ name: 'read_file', arguments: { path: file } });
  assert.ok(!read.isError, JSON.stringify(read));
  assert.ok(read.content.some(block => block.type === 'text' && block.text.includes('Xin chào từ MCP HTTP local.')));
  const adminHeaders = { 'x-local-admin': '1' };
  const adminPage = await request('/admin', { headers: adminHeaders });
  assert.equal(adminPage.status, 200);
  assert.match(await adminPage.text(), /Lịch sử request/);
  const adminHistory = await request('/admin/api/requests', { headers: adminHeaders });
  assert.equal(adminHistory.status, 200);
  const historyPayload = await adminHistory.json();
  assert.ok(historyPayload.stats.total >= 2);
  assert.equal(historyPayload.requests.find(entry => entry.toolName === 'write_file').arguments.content, '[ẩn vì riêng tư]');
  // Chat identifiers are not exposed by MCP; manually linked conversations are local-only.
  const writeRequest = historyPayload.requests.find(entry => entry.toolName === 'write_file');
  const chatsBefore = await request('/admin/api/chats', { headers: adminHeaders });
  assert.equal(chatsBefore.status, 200);
  assert.deepEqual((await chatsBefore.json()).links, []);
  const linkHeaders = { ...adminHeaders, 'x-dc-admin-action': '1', 'content-type': 'application/json' };
  const linkPayload = (chatUrl, requestId = writeRequest.id) => JSON.stringify({ requestId, chatUrl });
  const missingAction = await request('/admin/api/chats', {
    method: 'POST', headers: { ...adminHeaders, 'content-type': 'application/json' }, body: linkPayload('https://chatgpt.com/c/abcdef12-0000-1234-5678-1234567890ab')
  });
  assert.equal(missingAction.status, 403, 'Mutations must require the CSRF barrier header');
  for (const url of ['https://evil.example/c/abcdef12-0000-1234-5678-1234567890ab', 'https://chatgpt.com.evil.com/c/abcdef12-0000-1234-5678-1234567890ab', 'http://chatgpt.com/c/abcdef12-0000-1234-5678-1234567890ab']) {
    const invalidLink = await request('/admin/api/chats', { method: 'POST', headers: linkHeaders, body: linkPayload(url) });
    assert.equal(invalidLink.status, 400, 'Invalid chat URL must not be stored');
  }
  const chatUrl = 'https://chatgpt.com/c/abcdef12-0000-1234-5678-1234567890ab';
  const savedChat = await request('/admin/api/chats', { method: 'POST', headers: linkHeaders, body: linkPayload(chatUrl) });
  assert.equal(savedChat.status, 200);
  const stored = (await savedChat.json()).link;
  assert.equal(stored.chatId, 'abcdef12-0000-1234-5678-1234567890ab');
  assert.equal(stored.requestId, writeRequest.id);
  const chatsAfter = await (await request('/admin/api/chats', { headers: adminHeaders })).json();
  assert.equal(chatsAfter.links.length, 1);
  assert.equal(chatsAfter.links[0].chatUrl, chatUrl);
  const fakeId = await request('/admin/api/chats', { method: 'POST', headers: linkHeaders, body: linkPayload(chatUrl, 'not-an-existing-request') });
  assert.equal(fakeId.status, 404, 'Unknown request cannot be linked');
  assert.equal(historyPayload.stats.success + historyPayload.stats.errors, historyPayload.stats.total);
  assert.ok(historyPayload.stats.averageMs >= 0);
  assert.equal(historyPayload.stats.hourly.length, 12);
  assert.ok(historyPayload.stats.toolBreakdown.find(item => item.name === 'write_file'));
  // Skill management remains on the loopback admin interface and never downloads arbitrary scripts.
  const skillsBefore = await request('/admin/api/skills', { headers: adminHeaders });
  assert.equal(skillsBefore.status, 200);
  const initialSkills = await skillsBefore.json();
  assert.ok(Array.isArray(initialSkills.skills));
  assert.ok(initialSkills.recommended.includes('impeccable'));
  const customSkill = join(temporary, 'demo-skill');
  await mkdir(customSkill, { recursive: true });
  await writeFile(join(customSkill, 'SKILL.md'), '---\nname: demo-skill\ndescription: Safe test instructions.\n---\n# Demo Skill\nTesting only.');
  const skillWithoutAction = await request('/admin/api/skills', { method: 'POST', headers: adminHeaders });
  assert.equal(skillWithoutAction.status, 403);
  const registerSkill = await request('/admin/api/skills', {
    method: 'POST', headers: linkHeaders, body: JSON.stringify({ folder: customSkill }),
  });
  assert.equal(registerSkill.status, 200);
  const skillsAfter = await (await request('/admin/api/skills', { headers: adminHeaders })).json();
  assert.ok(skillsAfter.skills.some(s => s.name === 'demo-skill' && s.enabled));
  const skillRead = await client.callTool({ name: 'read_skill', arguments: { name: 'demo-skill' } });
  assert.equal(skillRead.isError, undefined);
  assert.ok(skillRead.content.some(item => item.text?.includes('Testing only.')));
  const preview = await request('/admin/api/skills/demo-skill', { headers: adminHeaders });
  assert.equal(preview.status, 200);
  assert.match((await preview.json()).markdown, /Safe test instructions/);
  const disableSkill = await request('/admin/api/skills/enable', {
    method: 'POST', headers: linkHeaders, body: JSON.stringify({ name: 'demo-skill', enabled: false }),
  });
  assert.equal(disableSkill.status, 200);
  const disabledRead = await client.callTool({ name: 'read_skill', arguments: { name: 'demo-skill' } });
  assert.equal(disabledRead.isError, true);
  const removeSkill = await request('/admin/api/skills/remove', {
    method: 'POST', headers: linkHeaders, body: JSON.stringify({ name: 'demo-skill' }),
  });
  assert.equal(removeSkill.status, 200);
  assert.match(await readFile(join(customSkill, 'SKILL.md'), 'utf8'), /Testing only/, 'Removing never deletes the source skill file.');

  const cleared = await request('/admin/api/clear', { method: 'POST', headers: adminHeaders });
  assert.equal(cleared.status, 200);
  assert.equal((await (await request('/admin/api/requests', { headers: adminHeaders })).json()).stats.total, 0);
  assert.equal((await (await request('/admin/api/chats', { headers: adminHeaders })).json()).links.length, 0, 'Clearing request history also clears local chat associations');

  assert.equal((await request('/mcp', { headers: { Authorization: `Bearer ${tokens.access_token}` } })).status, 405);
  await client.close(); client = undefined;

  const refreshedResponse = await form('/token', { grant_type: 'refresh_token', client_id: registered.client_id, refresh_token: tokens.refresh_token, resource: `${origin}/mcp` });
  assert.equal(refreshedResponse.status, 200);
  const refreshed = await refreshedResponse.json();
  assert.notEqual(refreshed.access_token, tokens.access_token);
  assert.equal((await request('/mcp', { headers: { Authorization: `Bearer ${tokens.access_token}` } })).status, 401);
  assert.equal((await form('/token', { grant_type: 'refresh_token', client_id: registered.client_id, refresh_token: tokens.refresh_token })).status, 400);
  assert.equal((await request('/mcp', { headers: { Authorization: `Bearer ${refreshed.access_token}` } })).status, 405);
  assert.equal((await form('/revoke', { client_id: registered.client_id, token: refreshed.access_token })).status, 200);
  assert.equal((await request('/mcp', { headers: { Authorization: `Bearer ${refreshed.access_token}` } })).status, 401);
  assert.equal((await form('/token', { grant_type: 'refresh_token', client_id: registered.client_id, refresh_token: refreshed.refresh_token })).status, 400);
  const limitedAuthorization = await request(`/authorize?${new URLSearchParams(params)}`);
  const limitedCookie = limitedAuthorization.headers.get('set-cookie').split(';')[0];
  const limitedId = (await limitedAuthorization.text()).match(/name="requestId" value="([^"]+)"/)[1];
  for (let attempt = 0; attempt < 5; attempt++) assert.equal((await form('/consent', { requestId: limitedId, secret: 'wrong' }, { Cookie: limitedCookie, Origin: origin })).status, 401);
  assert.equal((await form('/consent', { requestId: limitedId, secret }, { Cookie: limitedCookie, Origin: origin })).status, 429);

  process.kill(gateway.backendPid);
  await Promise.race([gateway.closed, new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('Gateway did not close after backend failure.')), 10_000); timer.unref(); })]);
  await assert.rejects(request('/health'), /fetch failed/);
  console.log(`PASS: OAuth discovery, DCR, consent, CSRF, login limit, PKCE, single-use codes, ${listed.tools.length} ChatGPT tools, real file read/write, offline_access, refresh rotation, revocation and backend failure cleanup.`);
} finally {
  await client?.close().catch(() => {});
  await gateway?.close();
  await rm(temporary, { recursive: true, force: true });
}
