import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { createHash, randomBytes } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { startGateway } from '../scripts/local-web-gateway.mjs';
import { executeAgentTool, closeAgentCommands } from '../scripts/agent-runtime.mjs';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const temporary = await mkdtemp(join(tmpdir(), 'dc-multi-device-test-'));
const freePort = createServer();
await new Promise(resolve => freePort.listen(0, '127.0.0.1', resolve));
const port = freePort.address().port;
await new Promise(resolve => freePort.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const secret = randomBytes(32).toString('base64url');
let gateway;
let client;
const workers = [];

try {
  gateway = await startGateway({ port, publicUrl: origin, connectionSecret: secret, configDir: join(temporary, 'profile') });
  const request = (path, options = {}) => fetch(`${origin}${path}`, { redirect: 'manual', ...options });
  const jsonRequest = (path, body, headers = {}) => request(path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const adminHeaders = { 'x-local-admin': '1' };
  const adminWriteHeaders = { ...adminHeaders, 'x-dc-admin-action': '1' };

  async function pair(name, capabilities = ['run_command', 'read_file', 'write_file']) {
    const pairingResponse = await jsonRequest('/admin/api/devices/pairing', { label: name }, adminWriteHeaders);
    assert.equal(pairingResponse.status, 200);
    const pairing = await pairingResponse.json();
    assert.match(pairing.code, /^[A-Z0-9]{10}$/);
    const response = await jsonRequest('/agent/pair', { code: pairing.code, name, hostname: name, platform: 'windows', version: 'test-agent', capabilities });
    assert.equal(response.status, 200);
    const paired = await response.json();
    assert.ok(paired.device_id);
    assert.ok(paired.agent_key);
    return paired;
  }

  async function startWorker(agent, root) {
    let stopped = false;
    const errors = [];
    const headers = { Authorization: `Bearer ${agent.agent_key}`, 'Content-Type': 'application/json' };
    const worker = (async () => {
      while (!stopped) {
        try {
          const response = await jsonRequest('/agent/poll', { deviceId: agent.device_id, hostname: agent.name, platform: 'windows', version: 'test-agent', capabilities: ['run_command', 'read_file', 'write_file'] }, headers);
          if (!response.ok) throw new Error(`poll ${response.status}`);
          const body = await response.json();
          if (body.job) {
            const result = await executeAgentTool(body.job.tool, { ...body.job.arguments, cwd: body.job.arguments?.cwd || root });
            const resultResponse = await jsonRequest('/agent/result', { deviceId: agent.device_id, jobId: body.job.job_id, result }, headers);
            if (!resultResponse.ok) throw new Error(`result ${resultResponse.status}`);
          }
        } catch (error) {
          errors.push(error);
          await sleep(20);
        }
        await sleep(20);
      }
    })();
    workers.push({ stop: () => { stopped = true; }, worker, errors });
  }

  const firstRoot = join(temporary, 'agent-one');
  const secondRoot = join(temporary, 'agent-two');
  await mkdir(firstRoot, { recursive: true });
  await mkdir(secondRoot, { recursive: true });
  const first = await pair('Agent One');
  const second = await pair('Agent Two');
  await startWorker(first, firstRoot);
  await startWorker(second, secondRoot);
  await sleep(100);

  const registration = await jsonRequest('/register', { client_name: 'multi-device-test', redirect_uris: ['https://chatgpt.com/connector_platform/oauth/callback'], token_endpoint_auth_method: 'none', grant_types: ['authorization_code'], response_types: ['code'] });
  assert.equal(registration.status, 201);
  const registered = await registration.json();
  const verifier = randomBytes(32).toString('base64url');
  const params = { response_type: 'code', client_id: registered.client_id, redirect_uri: 'https://chatgpt.com/connector_platform/oauth/callback', code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', state: 'multi-device', resource: `${origin}/mcp`, scope: 'desktop' };
  const authorization = await request(`/authorize?${new URLSearchParams(params)}`);
  assert.equal(authorization.status, 200);
  const cookie = authorization.headers.get('set-cookie').split(';')[0];
  const html = await authorization.text();
  const requestId = html.match(/name="requestId" value="([^"]+)"/)[1];
  const consent = await request('/consent', { method: 'POST', headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ requestId, secret }) });
  assert.equal(consent.status, 302);
  const code = new URL(consent.headers.get('location')).searchParams.get('code');
  const tokenResponse = await request('/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', client_id: registered.client_id, code, code_verifier: verifier, redirect_uri: params.redirect_uri, resource: `${origin}/mcp` }) });
  assert.equal(tokenResponse.status, 200);
  const tokens = await tokenResponse.json();

  client = new Client({ name: 'multi-device-test', version: '1.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${origin}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${tokens.access_token}` } } }));
  const listed = await client.listTools();
  assert.equal(listed.tools.filter(tool => !tool.name.startsWith('windows_')).length, 23);
  assert.ok(listed.tools.some(tool => tool.name === 'windows_on_device'));
  assert.ok(listed.tools.some(tool => tool.name === 'run_on_device'));
  const devicesResult = await client.callTool({ name: 'list_devices', arguments: {} });
  const devices = JSON.parse(devicesResult.content[0].text);
  assert.equal(devices.length, 2);
  assert.ok(devices.every(device => device.status === 'online'));

  async function call(name, args) {
    const result = await client.callTool({ name, arguments: args });
    assert.equal(result.isError, undefined, `${name}: ${JSON.stringify(result)}`);
    return JSON.parse(result.content[0].text);
  }
  const oneCommand = await call('run_on_device', { device_id: first.device_id, command: 'Write-Output DEVICE_ONE', cwd: firstRoot, timeout_ms: 10_000 });
  const twoCommand = await call('run_on_device', { device_id: second.device_id, command: 'Write-Output DEVICE_TWO', cwd: secondRoot, timeout_ms: 10_000 });
  assert.match(oneCommand.result.stdout, /DEVICE_ONE/);
  assert.match(twoCommand.result.stdout, /DEVICE_TWO/);
  assert.equal(oneCommand.device_id, first.device_id);
  assert.equal(twoCommand.device_id, second.device_id);

  const markerOne = join(firstRoot, 'marker.txt');
  const markerTwo = join(secondRoot, 'marker.txt');
  await call('write_file_on_device', { device_id: first.device_id, path: markerOne, content: 'one' });
  await call('write_file_on_device', { device_id: second.device_id, path: markerTwo, content: 'two' });
  const readOne = await call('read_file_on_device', { device_id: first.device_id, path: markerOne });
  const readTwo = await call('read_file_on_device', { device_id: second.device_id, path: markerTwo });
  assert.match(readOne.result.text, /one/);
  assert.match(readTwo.result.text, /two/);
  assert.equal(await readFile(markerOne, 'utf8'), 'one');
  assert.equal(await readFile(markerTwo, 'utf8'), 'two');

  // The third Agent is an HTTP fixture only; no desktop input or screen capture runs.
  const desktop = await pair('Desktop fixture', ['windows_tool']);
  const desktopHeaders = { Authorization: `Bearer ${desktop.agent_key}` };
  const pollDesktop = () => jsonRequest('/agent/poll', { deviceId: desktop.device_id, capabilities: ['windows_tool'] }, desktopHeaders);
  assert.equal((await pollDesktop()).status, 200);
  const typedMarker = 'REMOTE_TYPED_VALUE_PRIVATE';
  const screenText = 'REMOTE_SCREEN_TEXT_PRIVATE';
  const image = { type: 'image', mimeType: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3foAAAAASUVORK5CYII=' };
  const desktopCall = client.callTool({ name: 'windows_on_device', arguments: { device_id: desktop.device_id, name: 'windows_type', arguments: { text: typedMarker } } }, undefined, { timeout: 10_000 });
  let desktopJob;
  for (let attempt = 0; attempt < 100 && !desktopJob; attempt++) {
    const response = await pollDesktop();
    assert.equal(response.status, 200);
    desktopJob = (await response.json()).job;
    if (!desktopJob) await sleep(20);
  }
  assert.ok(desktopJob, 'OAuth MCP desktop call reached the assigned outbound Agent');
  assert.equal(desktopJob.tool, 'windows_tool');
  assert.deepEqual(desktopJob.arguments, { name: 'windows_type', arguments: { text: typedMarker } });
  assert.ok(!(await readFile(join(temporary, 'devices.json'), 'utf8')).includes(typedMarker), 'queued typed text is not persisted');
  const desktopSubmission = await jsonRequest('/agent/result', { deviceId: desktop.device_id, jobId: desktopJob.job_id, result: { content: [{ type: 'text', text: screenText }, image] } }, desktopHeaders);
  assert.equal(desktopSubmission.status, 200);
  const desktopResult = await desktopCall;
  assert.equal(desktopResult.isError, undefined);
  assert.deepEqual(desktopResult.content.filter(block => block.type === 'image'), [image]);
  const desktopEnvelope = JSON.parse(desktopResult.content[0].text);
  assert.equal(desktopEnvelope.job_id, desktopJob.job_id);
  assert.equal(desktopEnvelope.device_id, desktop.device_id);
  assert.equal(desktopEnvelope.status, 'completed');
  assert.equal(desktopEnvelope.result, screenText);
  const fetchedDesktop = await client.callTool({ name: 'get_job_status', arguments: { job_id: desktopJob.job_id } });
  assert.equal(fetchedDesktop.isError, undefined);
  assert.deepEqual(fetchedDesktop.content.filter(block => block.type === 'image'), [image]);
  assert.equal(JSON.parse(fetchedDesktop.content[0].text).result, screenText);

  const dashboard = await request('/admin/api/devices', { headers: adminHeaders });
  assert.equal(dashboard.status, 200);
  const dashboardData = await dashboard.json();
  assert.equal(dashboardData.devices.length, 3);
  assert.ok(dashboardData.jobs.length >= 4);
  assert.ok(dashboardData.jobs.every(job => !Object.hasOwn(job, 'agent_key')));
  const desktopHistory = dashboardData.jobs.find(job => job.job_id === desktopJob.job_id);
  assert.deepEqual(JSON.parse(desktopHistory.result.content[0].text).content_counts, { text: 1, image: 1 });
  const persistedDevices = await readFile(join(temporary, 'devices.json'), 'utf8');
  for (const marker of [typedMarker, screenText, image.data]) {
    assert.ok(!JSON.stringify(dashboardData).includes(marker), 'dashboard desktop history excludes private payloads');
    assert.ok(!persistedDevices.includes(marker), 'persisted desktop history excludes private payloads');
  }
  assert.equal((await jsonRequest('/agent/poll', { deviceId: first.device_id }, { Authorization: 'Bearer invalid-agent-key' })).status, 401);
  console.log('PASS: OAuth MCP -> Hub -> two real file/command Agents plus desktop HTTP fixture, image forwarding, private dashboard history and credential rejection.');
} finally {
  for (const entry of workers) entry.stop();
  await Promise.allSettled(workers.map(entry => entry.worker));
  await closeAgentCommands();
  await client?.close().catch(() => {});
  await gateway?.close();
  await rm(temporary, { recursive: true, force: true });
}
