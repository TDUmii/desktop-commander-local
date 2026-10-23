import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWindowsTools } from '../scripts/windows-tools.mjs';
import { createRequestHistory } from '../scripts/local-admin.mjs';

const fixture = join(dirname(fileURLToPath(import.meta.url)), 'helpers/windows-worker-fixture.mjs');
const events = async file => (await readFile(file, 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line));

async function withWorker(run, extraArgs = []) {
  const root = await mkdtemp(join(tmpdir(), 'umibridge-windows-tools-'));
  const journal = join(root, 'worker.jsonl');
  const worker = createWindowsTools({ root, executable: process.execPath, args: [fixture, '--worker-fixture', '--journal', journal, ...extraArgs], timeoutMs: 5_000,
    env: { ANONYMIZED_TELEMETRY: 'true', POSTHOG_API_KEY: 'fixture-ignored', WINDOWS_MCP_WATCHDOG: 'true', WINDOWS_MCP_CONTROL: 'false' } });
  try { await run({ root, journal, worker }); }
  finally {
    await worker.close();
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

test('one Windows worker serves concurrent tool lists with prefixed schemas and no duplicate shell', async () => {
  await withWorker(async ({ worker, journal }) => {
    const lists = await Promise.all([worker.listTools(), worker.listTools(), worker.listTools()]);
    const names = lists[0].map(tool => tool.name);
    assert.deepEqual(names, ['windows_screenshot', 'windows_display_inventory', 'windows_uia_probe', 'windows_scrape', 'windows_crash']);
    assert.ok(lists.every(list => JSON.stringify(list) === JSON.stringify(lists[0])));
    assert.deepEqual(lists[0][0].annotations, { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false });
    assert.equal(lists[0][0].inputSchema.additionalProperties, true);
    assert.equal(worker.status().state, 'ready');
    assert.equal(worker.status().toolCount, 5);
    await worker.listTools();
    assert.equal((await events(journal)).filter(item => item.event === 'start').length, 1);
    assert.equal((await events(journal)).filter(item => item.event === 'list').length, 1);
    assert.equal((await worker.callTool('windows_powershell', {})).isError, true);
    assert.equal((await events(journal)).filter(item => item.event === 'call').length, 0);
  });
});

test('Windows forwarding preserves mixed screenshot results and forces safe worker environment and raw Scrape', async () => {
  await withWorker(async ({ worker, journal }) => {
    await worker.listTools();
    const result = await worker.callTool('windows_screenshot', { display: [0] });
    assert.equal(result.isError, false);
    assert.deepEqual(result.content, [
      { type: 'text', text: 'Fixture screen dimensions: 1 x 1' },
      { type: 'image', mimeType: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3foAAAAASUVORK5CYII=' },
    ]);
    assert.deepEqual(result.structuredContent, { screen: { width: 1, height: 1 }, source: 'fixture' });
    const scrape = await worker.callTool('windows_scrape', { url: 'https://example.invalid/', use_sampling: true });
    const payload = JSON.parse(scrape.content[0].text);
    assert.equal(payload.use_sampling, false);
    assert.equal(payload.telemetry, 'false');
    assert.equal(payload.posthog, '');
    assert.equal(payload.watchdog, 'false');
    assert.equal(payload.control, 'true');
    assert.equal((await worker.callTool('windows_scrape', [])).isError, true);
    const calls = (await events(journal)).filter(item => item.event === 'call');
    assert.deepEqual(calls.map(item => item.name), ['Screenshot', 'Scrape']);
    assert.deepEqual(calls[0].args, { display: [0] });
  });
});

test('a lost Windows worker never replays an uncertain action or restarts implicitly', async () => {
  await withWorker(async ({ worker, journal }) => {
    await worker.listTools();
    const result = await worker.callTool('windows_crash', { action: 'fixture-only' });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /may already have run/);
    assert.match(result.content[0].text, /not retried/);
    assert.equal(worker.status().state, 'error');
    assert.equal((await worker.callTool('windows_screenshot', {})).isError, true);
    let recorded = await events(journal);
    assert.equal(recorded.filter(item => item.event === 'start').length, 1);
    assert.equal(recorded.filter(item => item.event === 'call').length, 1);
    assert.equal((await worker.listTools()).length, 5, 'An explicit new listing may reconnect.');
    recorded = await events(journal);
    assert.equal(recorded.filter(item => item.event === 'start').length, 2);
    assert.equal(recorded.filter(item => item.event === 'call').length, 1);
    const firstClose = worker.close();
    assert.equal(worker.close(), firstClose);
    await firstClose;
    assert.equal(worker.status().state, 'closed');
    assert.deepEqual(await worker.listTools(), []);
    assert.equal((await worker.callTool('windows_screenshot', {})).isError, true);
  });
});

test('missing optional Windows runtime is unavailable and broken startup diagnostics stay private', async () => {
  const root = await mkdtemp(join(tmpdir(), 'umibridge-no-windows-tools-'));
  const worker = createWindowsTools({ root });
  try {
    assert.deepEqual(await worker.listTools(), []);
    assert.equal(worker.status().state, 'unavailable');
    assert.equal(worker.status().runtimeInstalled, false);
    assert.equal((await worker.callTool('windows_screenshot', {})).isError, true);
  } finally {
    await worker.close();
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
  await withWorker(async ({ worker, root }) => {
    assert.deepEqual(await worker.listTools(), []);
    assert.equal(worker.status().state, 'error');
    const publicResult = JSON.stringify({ status: worker.status(), call: await worker.callTool('windows_screenshot', {}) });
    assert.ok(!publicResult.includes('fixture-password-never-persist'));
    assert.ok(!publicResult.includes(root));
    assert.ok(!publicResult.includes(process.execPath));
  }, ['--fail-start']);
});

test('desktop request history hides typed, clipboard, registry and multi-edit values and screen output', async () => {
  const root = await mkdtemp(join(tmpdir(), 'umibridge-windows-history-'));
  const file = join(root, 'requests.jsonl');
  try {
    const history = await createRequestHistory(file);
    const result = { content: [{ type: 'text', text: 'SCREEN_RESULT_PRIVATE' }, { type: 'image', mimeType: 'image/png', data: 'SCREEN_IMAGE_PRIVATE' }], structuredContent: { title: 'SCREEN_TITLE_PRIVATE' } };
    await history.add('windows_type', { text: 'TYPED_VALUE_PRIVATE', loc: [10, 20] }, result, 1, 'ChatGPT');
    await history.add('windows_clipboard', { mode: 'set', text: 'CLIPBOARD_VALUE_PRIVATE' }, result, 1, 'ChatGPT');
    await history.add('windows_registry', { mode: 'set', path: 'HKCU:\\Software\\Fixture', value: 'REGISTRY_VALUE_PRIVATE' }, result, 1, 'ChatGPT');
    await history.add('windows_notification', { message: 'NOTIFICATION_VALUE_PRIVATE', args: ['ARGUMENT_VALUE_PRIVATE'] }, result, 1, 'ChatGPT');
    await history.add('windows_multi_edit', { labels: ['LABEL_VALUE_PRIVATE'], locs: [[10, 20]], text: 'MULTI_TEXT_PRIVATE', edits: [{ value: 'NESTED_VALUE_PRIVATE' }] }, result, 1, 'ChatGPT');
    const disk = await readFile(file, 'utf8');
    for (const marker of ['SCREEN_RESULT_PRIVATE', 'SCREEN_IMAGE_PRIVATE', 'SCREEN_TITLE_PRIVATE', 'TYPED_VALUE_PRIVATE', 'CLIPBOARD_VALUE_PRIVATE', 'REGISTRY_VALUE_PRIVATE', 'NOTIFICATION_VALUE_PRIVATE', 'ARGUMENT_VALUE_PRIVATE', 'LABEL_VALUE_PRIVATE', 'MULTI_TEXT_PRIVATE', 'NESTED_VALUE_PRIVATE']) assert.ok(!disk.includes(marker), marker);
    const multi = history.list().find(item => item.toolName === 'windows_multi_edit');
    assert.equal(multi.arguments.labels, '[redacted for privacy]');
    assert.equal(multi.arguments.locs, '[redacted for privacy]');
    assert.equal(multi.output, undefined);
    assert.equal(multi.usage.scope, 'text-tool-payloads');
  } finally {
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
