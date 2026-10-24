import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { randomBytes } from 'node:crypto';
import { startGateway } from '../scripts/local-web-gateway.mjs';

async function freePort() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function openGateway(workflowEnabled, marker = false) {
  const root = await mkdtemp(join(tmpdir(), 'umibridge-workflow-gateway-'));
  const profile = join(root, 'profile');
  if (marker) {
    await mkdir(profile, { recursive: true });
    await writeFile(join(profile, 'workflows-enabled'), '');
  }
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const gateway = await startGateway({ port, publicUrl: origin, connectionSecret: randomBytes(32).toString('base64url'), configDir: profile, workflowEnabled });
  const request = (path, options = {}) => fetch(`${origin}${path}`, { ...options, headers: { 'x-local-admin': '1', ...(options.headers ?? {}) } });
  return { root, gateway, request };
}

test('workflow API is unavailable when the feature flag is off', async () => {
  const opened = await openGateway(false);
  try {
    const response = await opened.request('/admin/api/workflows');
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'workflows_disabled', enabled: false });
  } finally { await opened.gateway.close(); await rm(opened.root, { recursive: true, force: true }); }
});

test('workflow opt-in marker is profile-local and explicit false overrides marker or environment', async () => {
  const previous = process.env.UMIBRIDGE_WORKFLOWS;
  delete process.env.UMIBRIDGE_WORKFLOWS;
  const opened = [];
  try {
    for (const [workflowEnabled, marker, environment, expected] of [
      [undefined, false, undefined, 404],
      [undefined, true, undefined, 200],
      [false, true, undefined, 404],
      [undefined, false, undefined, 404],
      [undefined, false, '1', 200],
      [false, false, '1', 404],
    ]) {
      if (environment === undefined) delete process.env.UMIBRIDGE_WORKFLOWS;
      else process.env.UMIBRIDGE_WORKFLOWS = environment;
      const current = await openGateway(workflowEnabled, marker);
      opened.push(current);
      assert.equal((await current.request('/admin/api/workflows')).status, expected);
    }
  } finally {
    for (const current of opened) {
      await current.gateway.close();
      await rm(current.root, { recursive: true, force: true });
    }
    if (previous === undefined) delete process.env.UMIBRIDGE_WORKFLOWS;
    else process.env.UMIBRIDGE_WORKFLOWS = previous;
  }
});

test('workflow API guards writes and supports manual lifecycle, linking, events and export', async () => {
  const opened = await openGateway(true);
  try {
    const read = await opened.request('/admin/api/workflows');
    assert.equal(read.status, 200);
    assert.deepEqual((await read.json()).workflows, []);
    const payload = { projectKey: 'project-demo', chatKey: 'chat-demo', title: 'Manual task', role: 'builder', requestIds: ['request-1'] };
    const denied = await opened.request('/admin/api/workflows', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    assert.equal(denied.status, 403);
    const createdResponse = await opened.request('/admin/api/workflows', { method: 'POST', headers: { 'content-type': 'application/json', 'x-dc-admin-action': '1' }, body: JSON.stringify(payload) });
    assert.equal(createdResponse.status, 201);
    const created = await createdResponse.json();
    assert.equal(created.status, 'queued');
    assert.equal(created.version, 1);
    assert.ok(created.missing_links.some(item => item.kind === 'request' && item.id === 'request-1'));

    const runningResponse = await opened.request(`/admin/api/workflows/${encodeURIComponent(created.workflow_id)}`, { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-dc-admin-action': '1' }, body: JSON.stringify({ status: 'running', version: created.version }) });
    assert.equal(runningResponse.status, 200);
    const running = await runningResponse.json();
    const conflict = await opened.request(`/admin/api/workflows/${encodeURIComponent(created.workflow_id)}`, { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-dc-admin-action': '1' }, body: JSON.stringify({ status: 'waiting', version: created.version }) });
    assert.equal(conflict.status, 409);
    assert.equal((await conflict.json()).error, 'workflow_version_conflict');

    const linkResponse = await opened.request(`/admin/api/workflows/${encodeURIComponent(created.workflow_id)}/link-job`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-dc-admin-action': '1' }, body: JSON.stringify({ jobId: 'job-1', dispatchKey: 'dispatch-1', baselineHash: 'safe-hash', version: running.version }) });
    assert.equal(linkResponse.status, 200);
    const linked = await linkResponse.json();
    assert.equal(linked.job_id, 'job-1');
    const idempotentResponse = await opened.request(`/admin/api/workflows/${encodeURIComponent(created.workflow_id)}/link-job`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-dc-admin-action': '1' }, body: JSON.stringify({ jobId: 'job-1', dispatchKey: 'dispatch-1', baselineHash: 'safe-hash', version: linked.version }) });
    assert.equal(idempotentResponse.status, 200);
    assert.equal((await idempotentResponse.json()).idempotent, true);

    const events = await opened.request(`/admin/api/workflows/${encodeURIComponent(created.workflow_id)}/events`);
    assert.equal(events.status, 200);
    assert.ok((await events.json()).events.length >= 3);
    const exportedResponse = await opened.request('/admin/api/workflows/export', { method: 'POST', headers: { 'x-dc-admin-action': '1' } });
    assert.equal(exportedResponse.status, 200);
    const exported = await exportedResponse.json();
    assert.equal(exported.schema_version, 1);
  } finally { await opened.gateway.close(); await rm(opened.root, { recursive: true, force: true }); }
});
