import assert from 'node:assert/strict';
import test from 'node:test';
import { executeAgentTool } from '../scripts/agent-runtime.mjs';

test('Agent forwards validated desktop jobs to the initialized worker without altering MCP content', async () => {
  const payload = { content: [{ type: 'text', text: 'Fixture screen' }, { type: 'image', mimeType: 'image/png', data: 'RklYVFVSRQ==' }], structuredContent: { width: 1, height: 1 } };
  const calls = [];
  const windowsWorker = {
    status: () => ({ available: true }),
    callTool: async (name, args) => { calls.push({ name, args }); return payload; },
  };
  const options = { windowsWorker };
  const args = { name: 'windows_snapshot', arguments: { use_vision: true } };
  assert.deepEqual(await executeAgentTool('windows_tool', args, options), payload);
  assert.deepEqual(calls, [{ name: args.name, args: args.arguments }]);
  for (const invalid of [
    { name: 'run_command', arguments: {} },
    { name: 'windows_snapshot', arguments: [] },
    { name: 'windows_type', arguments: { text: 'x'.repeat(64 * 1024) } },
  ]) assert.equal((await executeAgentTool('windows_tool', invalid, options)).isError, true);
  windowsWorker.status = () => ({ available: false });
  assert.equal((await executeAgentTool('windows_tool', args, options)).isError, true);
  assert.equal(calls.length, 1, 'invalid jobs never reach the worker');
});
