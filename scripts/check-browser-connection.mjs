import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export async function checkBrowserConnection(stateDir = fileURLToPath(new URL('../.local-data/', import.meta.url))) {
  const status = JSON.parse(await readFile(resolve(stateDir, 'web-status.json'), 'utf8'));
  const secret = (await readFile(resolve(stateDir, 'gemini-pairing-secret.txt'), 'utf8')).trim();
  if (!Number.isInteger(status.port) || status.port < 1 || status.port > 65535 || !/^[A-Za-z0-9_-]{43}$/.test(secret)) {
    throw new Error('Invalid local browser connection configuration.');
  }
  const origin = `http://127.0.0.1:${status.port}`;
  const health = await fetch(origin + '/health', { signal: AbortSignal.timeout(5000) });
  if (!health.ok) throw new Error('The local gateway is not healthy.');
  const client = new Client({ name: 'UmiBridge browser setup check', version: '1.0.0' });
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(`/gemini/${secret}/mcp`, origin), {
      requestInit: { headers: { Origin: 'chrome-extension://kngiafgkdnlkgmefdafaibkibegkcaef' } },
    }), { timeout: 5000 });
    const { tools } = await client.listTools({}, { timeout: 5000 });
    for (const name of ['read_file', 'write_file', 'edit_block', 'run_command']) {
      if (!tools.some(tool => tool.name === name)) throw new Error('Required browser tools are unavailable.');
    }
    return tools.length;
  } finally { await client.close(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(`Local browser MCP check passed: ${await checkBrowserConnection()} tools available. This does not prove Gemini execution.`);
  } catch {
    console.error('Local browser MCP check failed. Restart UmiBridge.cmd -Action gemini and check the local dashboard. Connection credentials are not printed.');
    process.exitCode = 1;
  }
}
