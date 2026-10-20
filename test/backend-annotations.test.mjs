import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const temporary = await mkdtemp(join(tmpdir(), 'umibridge-annotations-'));
const client = new Client({ name: 'umibridge-annotations-test', version: '1.0.0' });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [resolve('scripts/chatgpt-backend.mjs')],
  env: { ...process.env, CHATGPT_LOCAL_CONFIG_DIR: join(temporary, 'profile') },
  stderr: 'pipe',
});
try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  const byName = new Map(tools.map(tool => [tool.name, tool]));
  const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
  for (const name of ['list_skills', 'read_skill', 'read_file', 'list_directory', 'get_file_info', 'search_files']) {
    assert.deepEqual(byName.get(name)?.annotations, readOnly, name);
  }
  for (const name of ['write_file', 'edit_block', 'move_file']) {
    assert.deepEqual(byName.get(name)?.annotations, { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false }, name);
  }
  assert.deepEqual(byName.get('create_directory')?.annotations, { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false });
  assert.deepEqual(byName.get('run_command')?.annotations, { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true });
  assert.equal(tools.length, 11);
  console.log('Backend exposes accurate MCP safety annotations over stdio.');
} finally {
  await client.close();
  await transport.close();
  await rm(temporary, { recursive: true, force: true });
}
