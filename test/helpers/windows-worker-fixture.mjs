import { appendFile } from 'node:fs/promises';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

// No worker is started when node --test discovers this helper on its own.
if (process.argv.includes('--worker-fixture')) {
  const journal = process.argv[process.argv.indexOf('--journal') + 1];
  const record = event => appendFile(journal, JSON.stringify(event) + '\n');
  await record({ event: 'start', pid: process.pid });
  if (process.argv.includes('--fail-start')) {
    process.stderr.write('fixture-password-never-persist: startup diagnostic\n');
    process.exit(17);
  }
  const annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
  const names = ['Screenshot', 'DisplayInventory', 'UIAProbe', 'Scrape', 'PowerShell', 'Crash'];
  const server = new Server({ name: 'windows-tools-fixture', version: '1.0.0' }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    await record({ event: 'list' });
    return { tools: names.map(name => ({ name, description: `Fixture ${name}`, annotations, inputSchema: { type: 'object', properties: {}, additionalProperties: true } })) };
  });
  server.setRequestHandler(CallToolRequestSchema, async request => {
    const { name, arguments: args } = request.params;
    await record({ event: 'call', name, args });
    if (name === 'Crash') {
      setTimeout(() => process.exit(19), 10);
      return new Promise(() => {});
    }
    if (name === 'Screenshot') return {
      content: [
        { type: 'text', text: 'Fixture screen dimensions: 1 x 1' },
        { type: 'image', mimeType: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3foAAAAASUVORK5CYII=' },
      ],
      structuredContent: { screen: { width: 1, height: 1 }, source: 'fixture' },
      isError: false,
    };
    if (name === 'Scrape') return { content: [{ type: 'text', text: JSON.stringify({ ...args, telemetry: process.env.ANONYMIZED_TELEMETRY, posthog: process.env.POSTHOG_API_KEY, watchdog: process.env.WINDOWS_MCP_WATCHDOG, control: process.env.WINDOWS_MCP_CONTROL }) }] };
    return { content: [{ type: 'text', text: 'fixture result' }] };
  });
  await server.connect(new StdioServerTransport());
}
