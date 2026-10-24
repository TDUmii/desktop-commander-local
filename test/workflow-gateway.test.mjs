import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
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

async function openGateway(workflowEnabled) {
  const root = await mkdtemp(join(tmpdir(), 'umibridge-workflow-gateway-'));
  const profile = join(root, 'profile');
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
