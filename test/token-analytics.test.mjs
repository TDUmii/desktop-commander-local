import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequestHistory } from '../scripts/local-admin.mjs';

test('token estimates use full UTF-8 text, preserve privacy, and survive the rolling history limit and restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'umibridge-tokens-'));
  const file = join(directory, 'requests.jsonl');
  try {
    const legacy = { id: 'legacy', timestamp: new Date().toISOString(), toolName: 'read_file', status: 'ok' };
    const malformed = { ...legacy, id: 'invalid-usage', usage: { estimated: true, method: 'utf8-bytes/4', inputTokens: -3, outputTokens: 2, totalTokens: -1 } };
    await writeFile(file, [legacy, malformed].map(value => JSON.stringify(value)).join('\n') + '\n');
    let history = await createRequestHistory(file, { secretValues: ['private-token-fixture'] });
    const args = { path: 'fixture.txt', content: 'Tiếng Việt 🌸'.repeat(1500) + 'private-token-fixture' };
    const result = { content: [{ type: 'text', text: 'Kết quả 🌸'.repeat(1500) }, { type: 'image', mimeType: 'image/png', data: 'not-counted' }] };
    const count = value => Math.ceil(Buffer.byteLength(JSON.stringify(value), 'utf8') / 4);
    const input = count({ name: 'write_file', arguments: args });
    const output = count(result.content.filter(item => item.type === 'text'));
    await history.add('write_file', args, result, 1, 'ChatGPT');
    const entry = history.list()[0];
    assert.deepEqual(entry.usage, { inputTokens: input, outputTokens: output, totalTokens: input + output, estimated: true, method: 'utf8-bytes/4' });
    assert.equal(entry.arguments.content, '[redacted for privacy]');
    assert.ok(!(await readFile(file, 'utf8')).includes('private-token-fixture'));
    for (let index = 0; index < 505; index++) await history.add('read_file', {}, { content: [{ type: 'text', text: 'ok' }] }, 1, 'Gemini');
    const before = history.stats().tokens;
    assert.equal(history.stats().total, 500);
    assert.equal(before.measuredRequests, 506);
    assert.equal(before.unmeasuredRequests, 2, 'Old or invalid measurements are not invented.');
    assert.equal(before.byProvider.find(row => row.provider === 'chatgpt').totalTokens, input + output, 'Totals include requests outside the visible 500.');
    assert.equal(before.byProvider.find(row => row.provider === 'gemini').measuredRequests, 505);
    assert.equal(before.inputTokens + before.outputTokens, before.totalTokens);
    assert.equal(before.recentTools[0].name, 'read_file');
    history = await createRequestHistory(file);
    assert.deepEqual(history.stats().tokens, before, 'Cumulative estimates and provider totals survive restart.');
    await history.clear();
    assert.equal(history.stats().tokens.totalTokens, 0);
    assert.equal((await createRequestHistory(file)).stats().tokens.measuredRequests, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
