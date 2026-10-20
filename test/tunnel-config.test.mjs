import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readTunnelConfig, tunnelUrlFromOutput } from '../scripts/tunnel-config.mjs';

test('uses the authoritative port URL, excluding inspection URLs and explicit port forms', () => {
  const output = 'Hosting port 43127 at https://random.asse.devtunnels.ms:43127/, https://random-43127.asse.devtunnels.ms/ and inspect it at https://random-43127-inspect.asse.devtunnels.ms/\n';
  assert.equal(tunnelUrlFromOutput(output, 'devtunnel', 43127), 'https://random-43127.asse.devtunnels.ms');
  assert.equal(tunnelUrlFromOutput('Hosting port 43127 at https://random-43127.asse.devtunnels.ms', 'devtunnel', 43127), 'https://random-43127.asse.devtunnels.ms');
  assert.equal(tunnelUrlFromOutput('Connection restored.\nHosting port: 43127\nConnect via browser: https://random-43127.asse.devtunnels.ms\nInspect network activity: https://random-43127-inspect.asse.devtunnels.ms\n', 'devtunnel', 43127), 'https://random-43127.asse.devtunnels.ms');
  assert.equal(tunnelUrlFromOutput(output, 'devtunnel', 12345), undefined);
  assert.equal(tunnelUrlFromOutput('https://bad.example/\n', 'devtunnel', 43127), undefined);
  assert.equal(tunnelUrlFromOutput('Created https://temporary-name.trycloudflare.com', 'cloudflare', 43127), 'https://temporary-name.trycloudflare.com');
});

test('rejects malformed, wrong-port and unsafe stable tunnel configuration', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'umibridge-tunnel-'));
  const save = value => writeFile(join(directory, 'tunnel-config.json'), JSON.stringify(value));
  const valid = { provider: 'devtunnel', tunnelId: 'umibridge-local.asse', port: 43127 };
  try {
    assert.deepEqual(await readTunnelConfig(directory, 43127), { provider: 'cloudflare' });
    await save(valid);
    assert.deepEqual(await readTunnelConfig(directory, 43127), valid);
    await assert.rejects(readTunnelConfig(directory, 43128), /does not match/);
    for (const publicUrl of ['http://random.asse.devtunnels.ms', 'https://random.example', 'https://user:password@random.asse.devtunnels.ms', 'https://random-inspect.asse.devtunnels.ms', 'https://random.asse.devtunnels.ms/admin']) {
      await save({ ...valid, publicUrl });
      await assert.rejects(readTunnelConfig(directory, 43127), /Invalid stable tunnel origin/);
    }
    await writeFile(join(directory, 'tunnel-config.json'), '{');
    await assert.rejects(readTunnelConfig(directory, 43127), /Invalid tunnel configuration/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
