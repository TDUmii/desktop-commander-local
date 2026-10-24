import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, appendFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createWorkflowLedger } from '../scripts/workflow-ledger.mjs';

async function tempLedger() {
  const root = await mkdtemp(join(tmpdir(), 'umibridge-workflow-'));
  return { root, file: join(root, 'workflows.jsonl') };
}

test('workflow ledger creates records and enforces the accepted state machine', async () => {
  const { file } = await tempLedger();
  const ledger = await createWorkflowLedger(file, { enabled: true });
  const workflow = await ledger.create({
    projectKey: 'project-demo', chatKey: 'chat-demo', title: 'Build a demo', role: 'builder',
    requestIds: ['request-123'], nextRole: 'reviewer', nextTask: 'Review the result', hop: 0,
  });
  assert.equal(workflow.status, 'queued');
  await assert.rejects(() => ledger.create({ projectKey: 'p', chatKey: 'c', title: 'Already running', status: 'running' }), /invalid_initial_status/);
  assert.equal(workflow.version, 1);
  assert.deepEqual(workflow.request_ids, ['request-123']);
  const running = await ledger.update(workflow.workflow_id, { status: 'running' }, 1);
  const paused = await ledger.update(workflow.workflow_id, { status: 'paused' }, running.version);
  const resumed = await ledger.update(workflow.workflow_id, { status: 'running' }, paused.version);
  const done = await ledger.update(workflow.workflow_id, { status: 'done' }, resumed.version);
  const archived = await ledger.update(workflow.workflow_id, { status: 'archived' }, done.version);
  assert.equal(archived.status, 'archived');
  await assert.rejects(() => ledger.update(workflow.workflow_id, { status: 'running' }, archived.version), /terminal_workflow/);
  await assert.rejects(() => ledger.update(workflow.workflow_id, { title: 'Mutated archive' }, archived.version), /terminal_workflow/);
});

test('workflow ledger rejects parent cycles', async () => {
  const { file } = await tempLedger();
  const ledger = await createWorkflowLedger(file, { enabled: true });
  const parent = await ledger.create({ projectKey: 'p', chatKey: 'c', title: 'Parent' });
  const child = await ledger.create({ projectKey: 'p', chatKey: 'c', title: 'Child', parentId: parent.workflow_id });
  await assert.rejects(() => ledger.update(parent.workflow_id, { parentId: child.workflow_id }, parent.version), /workflow_parent_cycle/);
  await assert.rejects(() => ledger.update(child.workflow_id, { parentId: child.workflow_id }, child.version), /workflow_parent_cycle/);
});

test('workflow ledger rejects stale writes and makes job linking idempotent', async () => {
  const { file } = await tempLedger();
  const ledger = await createWorkflowLedger(file, { enabled: true });
  const workflow = await ledger.create({ projectKey: 'p', chatKey: 'c', title: 'Task' });
  await assert.rejects(() => ledger.update(workflow.workflow_id, { status: 'running' }, 0), /workflow_version_conflict/);
  const running = await ledger.update(workflow.workflow_id, { status: 'running' }, workflow.version);
  const first = await ledger.linkJob(workflow.workflow_id, { jobId: 'job-1', dispatchKey: 'dispatch-1', baselineHash: 'hash-1', expectedVersion: running.version });
  const second = await ledger.linkJob(workflow.workflow_id, { jobId: 'job-1', dispatchKey: 'dispatch-1', baselineHash: 'hash-1', expectedVersion: first.version });
  assert.equal(second.job_id, 'job-1');
  assert.equal(second.idempotent, true);
  const duplicateKey = await ledger.linkJob(workflow.workflow_id, { jobId: 'job-2', dispatchKey: 'dispatch-1', baselineHash: 'hash-2', expectedVersion: second.version });
  assert.equal(duplicateKey.idempotent, true);
  assert.equal(duplicateKey.job_id, 'job-1');
});

test('workflow ledger recovers running tasks to waiting after restart without dispatching', async () => {
  const { file } = await tempLedger();
  const first = await createWorkflowLedger(file, { enabled: true });
  const workflow = await first.create({ projectKey: 'p', chatKey: 'c', title: 'Restart me' });
  await first.update(workflow.workflow_id, { status: 'running' }, workflow.version);
  const restarted = await createWorkflowLedger(file, { enabled: true });
  const recovered = await restarted.recover();
  assert.equal(recovered.changed, 1);
  const current = await restarted.get(workflow.workflow_id);
  assert.equal(current.status, 'waiting');
  assert.equal(current.blocked_reason, 'gateway_restart');
  assert.equal(current.job_id, null);
});

test('workflow ledger keeps a lost job association idempotent across restart recovery', async () => {
  const { file } = await tempLedger();
  const first = await createWorkflowLedger(file, { enabled: true });
  const workflow = await first.create({ projectKey: 'p', chatKey: 'c', title: 'Retry safely' });
  const running = await first.update(workflow.workflow_id, { status: 'running' }, workflow.version);
  const linked = await first.linkJob(workflow.workflow_id, { jobId: 'job-1', dispatchKey: 'dispatch-1', expectedVersion: running.version });
  const restarted = await createWorkflowLedger(file, { enabled: true });
  await restarted.recover();
  const recovered = await restarted.get(workflow.workflow_id);
  assert.equal(recovered.status, 'waiting');
  assert.equal(recovered.job_id, 'job-1');
  const retry = await restarted.linkJob(workflow.workflow_id, { jobId: 'job-1', dispatchKey: 'dispatch-1', expectedVersion: recovered.version });
  assert.equal(retry.idempotent, true);
  assert.equal(retry.job_id, linked.job_id);
});

test('workflow ledger ignores only malformed journal lines and redacts export data', async () => {
  const { file } = await tempLedger();
  const ledger = await createWorkflowLedger(file, { enabled: true });
  const workflow = await ledger.create({ projectKey: 'p', chatKey: 'c', title: 'Export me', blockedReason: 'See https://chatgpt.com/c/secret123 and token=secret-value' });
  await appendFile(file, '{"kind":"snapshot"', 'utf8');
  const restarted = await createWorkflowLedger(file, { enabled: true });
  const current = await restarted.get(workflow.workflow_id);
  assert.equal(current.title, 'Export me');
  const exported = await restarted.exportData();
  const serialized = JSON.stringify(exported);
  assert.equal(exported.schema_version, 1);
  assert.doesNotMatch(serialized, /https?:\/\//i);
  assert.doesNotMatch(serialized, /secret-value/);
  assert.match(await readFile(file, 'utf8'), /Export me/);
});

test('disabled workflow ledger is closed until the feature is explicitly enabled', async () => {
  const { file } = await tempLedger();
  const ledger = await createWorkflowLedger(file, { enabled: false });
  assert.deepEqual(await ledger.list(), []);
  await assert.rejects(() => ledger.create({ projectKey: 'p', chatKey: 'c', title: 'Nope' }), /workflows_disabled/);
});

test('workflow ledger keeps baseline and dispatch identifiers bounded to safe opaque values', async () => {
  const { file } = await tempLedger();
  const ledger = await createWorkflowLedger(file, { enabled: true });
  const workflow = await ledger.create({ projectKey: 'p', chatKey: 'c', title: 'Metadata only', baselineHash: 'raw prompt token=secret-value' });
  assert.equal(workflow.baseline_hash, null);
  const linked = await ledger.linkJob(workflow.workflow_id, { jobId: 'job-safe', dispatchKey: 'dispatch-safe', baselineHash: 'raw prompt secret-value', expectedVersion: workflow.version });
  assert.match(linked.baseline_hash, /^[a-f0-9]{64}$/);
  const jwtLike = await ledger.create({ projectKey: 'p', chatKey: 'c', title: 'JWT-like baseline', baselineHash: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJzZWNyZXQifQ.signature' });
  assert.equal(jwtLike.baseline_hash, null);
  assert.doesNotMatch(JSON.stringify(linked), /secret-value|raw prompt/);
  const second = await ledger.create({ projectKey: 'p', chatKey: 'c', title: 'Bad job' });
  await assert.rejects(() => ledger.linkJob(second.workflow_id, { jobId: 'https://secret.example/job', dispatchKey: 'safe-key', expectedVersion: second.version }), /invalid_job_id/);
});

test('workflow export and import preserve a redacted event timeline', async () => {
  const source = await tempLedger();
  const ledger = await createWorkflowLedger(source.file, { enabled: true });
  const workflow = await ledger.create({ projectKey: 'p', chatKey: 'c', title: 'Timeline' });
  await ledger.appendEvent(workflow.workflow_id, 'handoff', { status: 'review', note: 'token=secret-value', authorization: 'Bearer SECRET', apiKey: 'SECRET2' });
  assert.equal((await ledger.get(workflow.workflow_id)).version, 2);
  const exported = await ledger.exportData();
  assert.doesNotMatch(JSON.stringify(exported), /secret-value|SECRET2|Bearer SECRET/);
  const exportedHandoff = exported.workflows[0].events.find(event => event.type === 'handoff');
  assert.match(exportedHandoff.event_id, /^evt_/);
  const target = await tempLedger();
  const restored = await createWorkflowLedger(target.file, { enabled: true });
  await restored.importData(exported);
  const events = await restored.getEvents(workflow.workflow_id);
  const restoredHandoff = events.find(event => event.type === 'handoff');
  assert.equal(restoredHandoff.event_id, exportedHandoff.event_id);
  assert.equal(restoredHandoff.created_at, exportedHandoff.created_at);
  assert.doesNotMatch(JSON.stringify(events), /secret-value|SECRET2|Bearer SECRET/);
  assert.equal((await restored.importData(exported)).imported, 0);
});

test('workflow import makes active records safe to resume manually', async () => {
  const source = await tempLedger();
  const ledger = await createWorkflowLedger(source.file, { enabled: true });
  const workflow = await ledger.create({ projectKey: 'p', chatKey: 'c', title: 'Active export' });
  await ledger.update(workflow.workflow_id, { status: 'running' }, workflow.version);
  const exported = await ledger.exportData();
  const target = await tempLedger();
  const restored = await createWorkflowLedger(target.file, { enabled: true });
  await restored.importData(exported);
  const imported = await restored.get(workflow.workflow_id);
  assert.equal(imported.status, 'waiting');
  assert.equal(imported.blocked_reason, 'import_requires_resume');
  assert.equal(imported.job_id, null);
});

test('workflow listing honors bounded updated-at filters', async () => {
  const { file } = await tempLedger();
  const ledger = await createWorkflowLedger(file, { enabled: true });
  await ledger.create({ projectKey: 'p', chatKey: 'c', title: 'Filter me' });
  assert.deepEqual(ledger.list({ from: '2999-01-01T00:00:00.000Z' }), []);
  assert.deepEqual(ledger.list({ to: '2000-01-01T00:00:00.000Z' }), []);
});

test('workflow ledger serializes concurrent writers with a sidecar lock', async () => {
  const { file } = await tempLedger();
  const first = await createWorkflowLedger(file, { enabled: true });
  const second = await createWorkflowLedger(file, { enabled: true });
  await Promise.all([
    first.create({ projectKey: 'p1', chatKey: 'c1', title: 'First' }),
    second.create({ projectKey: 'p2', chatKey: 'c2', title: 'Second' }),
  ]);
  const lines = (await readFile(file, 'utf8')).trim().split(/\r?\n/).filter(Boolean);
  assert.equal(lines.length, 4);
  for (const line of lines) assert.doesNotThrow(() => JSON.parse(line));
});

test('workflow ledger makes concurrent same-dispatch links idempotent across instances', async () => {
  const { file } = await tempLedger();
  const first = await createWorkflowLedger(file, { enabled: true });
  const workflow = await first.create({ projectKey: 'p', chatKey: 'c', title: 'Concurrent link' });
  await first.update(workflow.workflow_id, { status: 'running' }, workflow.version);
  const second = await createWorkflowLedger(file, { enabled: true });
  const results = await Promise.allSettled([
    first.linkJob(workflow.workflow_id, { jobId: 'job-a', dispatchKey: 'same-dispatch' }),
    second.linkJob(workflow.workflow_id, { jobId: 'job-b', dispatchKey: 'same-dispatch' }),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 2);
  const reopened = await createWorkflowLedger(file, { enabled: true });
  const events = await reopened.getEvents(workflow.workflow_id);
  const links = events.filter(event => event.type === 'job_linked');
  assert.equal(links.length, 1);
  assert.equal(new Set(events.map(event => event.seq)).size, events.length);
});

test('workflow ledger rejects concurrent stale updates across instances', async () => {
  const { file } = await tempLedger();
  const first = await createWorkflowLedger(file, { enabled: true });
  const workflow = await first.create({ projectKey: 'p', chatKey: 'c', title: 'Concurrent update' });
  const second = await createWorkflowLedger(file, { enabled: true });
  const results = await Promise.allSettled([
    first.update(workflow.workflow_id, { title: 'First update' }, workflow.version),
    second.update(workflow.workflow_id, { title: 'Second update' }, workflow.version),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter(result => result.status === 'rejected' && /workflow_version_conflict/.test(result.reason?.message)).length, 1);
  const reopened = await createWorkflowLedger(file, { enabled: true });
  const current = await reopened.get(workflow.workflow_id);
  assert.equal(current.version, 2);
  assert.match(current.title, /First update|Second update/);
});

test('workflow ledger serializes concurrent event appends across instances', async () => {
  const { file } = await tempLedger();
  const first = await createWorkflowLedger(file, { enabled: true });
  const workflow = await first.create({ projectKey: 'p', chatKey: 'c', title: 'Concurrent events' });
  const second = await createWorkflowLedger(file, { enabled: true });
  await Promise.all([
    first.appendEvent(workflow.workflow_id, 'first', { status: 'review' }),
    second.appendEvent(workflow.workflow_id, 'second', { status: 'blocked' }),
  ]);
  const reopened = await createWorkflowLedger(file, { enabled: true });
  const events = await reopened.getEvents(workflow.workflow_id);
  assert.equal(events.filter(event => ['first', 'second'].includes(event.type)).length, 2);
  assert.equal(new Set(events.map(event => event.seq)).size, events.length);
});
