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
  // Match the gateway's filtered SDK environment instead of inheriting every host variable.
  env: { CHATGPT_LOCAL_CONFIG_DIR: join(temporary, 'profile') },
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
  const filePath = join(temporary, 'backend-proof.txt');
  assert.ok(!(await client.callTool({ name: 'write_file', arguments: { path: filePath, content: 'UMIBRIDGE_BACKEND_WRITE_OK' } })).isError);
  const read = await client.callTool({ name: 'read_file', arguments: { path: filePath } });
  assert.ok(read.content.some(block => block.text?.includes('UMIBRIDGE_BACKEND_WRITE_OK')));
  const command = await client.callTool({ name: 'run_command', arguments: { command: 'echo UMIBRIDGE_BACKEND_COMMAND_OK', cwd: temporary } });
  assert.ok(!command.isError);
  const output = JSON.parse(command.content[0].text);
  assert.equal(output.exit_code, 0);
  assert.match(output.stdout, /UMIBRIDGE_BACKEND_COMMAND_OK/);
  if (process.platform === 'win32') {
    const first = await client.callTool({ name: 'run_command', arguments: { command: '$global:UmiReuse = "READY"; Write-Output $PID', cwd: temporary } });
    const firstPayload = JSON.parse(first.content[0].text);
    const second = await client.callTool({ name: 'run_command', arguments: { command: 'Write-Output "$PID/$global:UmiReuse/$((Get-Process -Id $PID).MainWindowHandle)"', cwd: temporary } });
    const secondPayload = JSON.parse(second.content[0].text);
    assert.equal(firstPayload.exit_code, 0);
    assert.equal(secondPayload.exit_code, 0);
    assert.equal(secondPayload.stdout.trim(), `${firstPayload.stdout.trim()}/READY/0`);
    const native = await client.callTool({ name: 'run_command', arguments: { command: 'cmd.exe /d /c "echo FILTERED_ENV_STDOUT & echo FILTERED_ENV_STDERR 1>&2 & exit /b 7"', cwd: temporary } });
    const nativePayload = JSON.parse(native.content[0].text);
    assert.equal(nativePayload.exit_code, 7);
    assert.match(nativePayload.stdout, /FILTERED_ENV_STDOUT/);
    assert.match(nativePayload.stderr, /FILTERED_ENV_STDERR/);
  }
  console.log('Backend exposes accurate MCP safety annotations and executes real file/hidden command tools over stdio.');
} finally {
  await client.close();
  await transport.close();
  await rm(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
}
