import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDeviceRegistry } from '../scripts/device-registry.mjs';

test('device registry pairs multiple agents, routes jobs and persists safe metadata', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'umibridge-device-registry-'));
  let registry;
  try {
    registry = await createDeviceRegistry({ stateDir: temporary });
    const firstPairing = await registry.createPairing('Development laptop');
    await assert.rejects(registry.pair({ code: 'WRONG-CODE', name: 'bad' }), /invalid or expired/i);
    const first = await registry.pair({ code: firstPairing.code, name: 'Development laptop', hostname: 'DEV-01', platform: 'win32', capabilities: ['run_command'] });
    const secondPairing = await registry.createPairing('Office PC');
    const second = await registry.pair({ code: secondPairing.code, name: 'Office PC', hostname: 'OFFICE-02', platform: 'win32', capabilities: ['read_file'] });
    assert.equal(registry.listDevices().length, 2);
    assert.equal(registry.listDevices().every(device => device.status === 'offline'), true);

    await registry.poll({ deviceId: first.device_id, agentKey: first.agent_key, hostname: 'DEV-01', platform: 'win32', version: 'test', capabilities: ['run_command'] });
    await registry.poll({ deviceId: second.device_id, agentKey: second.agent_key, hostname: 'OFFICE-02', platform: 'win32', version: 'test', capabilities: ['read_file'] });
    const job = await registry.enqueue(first.device_id, 'run_command', { command: 'Write-Output DEVICE_ONE' });
    const assignment = await registry.poll({ deviceId: first.device_id, agentKey: first.agent_key });
    assert.equal(assignment.job.job_id, job.jobId);
    assert.equal(assignment.job.arguments.command, 'Write-Output DEVICE_ONE');
    const waiting = registry.waitForJob(job.jobId, 5000);
    await registry.result({ deviceId: first.device_id, agentKey: first.agent_key, jobId: job.jobId, result: { content: [{ type: 'text', text: JSON.stringify({ exit_code: 0, stdout: 'DEVICE_ONE' }) }] } });
    const completed = await waiting;
    assert.equal(completed.status, 'completed');
    assert.match(completed.result.content[0].text, /DEVICE_ONE/);

    await registry.close();
    registry = await createDeviceRegistry({ stateDir: temporary });
    assert.equal(registry.listDevices().length, 2, 'paired devices survive a Hub restart');
    assert.equal(registry.getJob(job.jobId).device_id, first.device_id);
    await assert.rejects(registry.poll({ deviceId: first.device_id, agentKey: second.agent_key }), /credential/i);
    await registry.revokeDevice(second.device_id);
    await assert.rejects(registry.poll({ deviceId: second.device_id, agentKey: second.agent_key }), /credential|unknown device/i);
    console.log('PASS: two linked agents, isolated credentials, job routing and restart persistence.');
  } finally {
    await registry?.close().catch(() => {});
    await rm(temporary, { recursive: true, force: true });
  }
});

test('remote desktop results keep mixed screenshots transient and never persist typed or clipboard values', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'umibridge-desktop-registry-'));
  let registry;
  try {
    registry = await createDeviceRegistry({ stateDir: temporary });
    const pairing = await registry.createPairing();
    const device = await registry.pair({ code: pairing.code, name: 'Desktop fixture', capabilities: ['read_file'] });
    const auth = { deviceId: device.device_id, agentKey: device.agent_key };
    await registry.poll(auth);
    await assert.rejects(registry.enqueue(device.device_id, 'windows_tool', { name: 'windows_snapshot', arguments: {} }), /unavailable/);
    await registry.poll({ ...auth, capabilities: ['read_file', 'windows_tool'] });
    await assert.rejects(registry.enqueue(device.device_id, 'windows_tool', { name: 'run_command', arguments: {} }), /Windows tool name/);
    await assert.rejects(registry.enqueue(device.device_id, 'windows_tool', { name: 'windows_type', arguments: { text: 'x'.repeat(64 * 1024) } }), /64 KiB/);

    const typed = 'PRIVATE_TYPED_VALUE_DESKTOP';
    const clipboard = 'PRIVATE_CLIPBOARD_VALUE_DESKTOP';
    const job = await registry.enqueue(device.device_id, 'windows_tool', { name: 'windows_type', arguments: { text: typed } });
    let disk = await readFile(join(temporary, 'devices.json'), 'utf8');
    assert.ok(!disk.includes(typed), 'queued desktop input remains memory-only');
    const assignment = await registry.poll(auth);
    assert.equal(assignment.job.arguments.arguments.text, typed);
    const image = Buffer.from('PRIVATE_SCREEN_IMAGE_'.repeat(20000)).toString('base64');
    assert.ok(image.length > 256000, 'fixture exceeds the old device result limit');
    const payload = { content: [{ type: 'text', text: clipboard }, { type: 'image', mimeType: 'image/png', data: image }], structuredContent: { privateEcho: typed } };
    const waiting = registry.waitForJob(job.jobId, 1000);
    const result = await registry.result({ ...auth, jobId: job.jobId, result: payload });
    assert.equal(result.status, 'completed');
    assert.deepEqual(result.result, payload);
    assert.deepEqual((await waiting).result, payload);
    assert.deepEqual(registry.getJob(job.jobId).result, payload);
    assert.deepEqual(job.args, {}, 'completed desktop input is released from live job state');
    const summary = registry.listJobs()[0].result;
    assert.deepEqual(JSON.parse(summary.content[0].text).content_counts, { text: 1, image: 1 });
    assert.ok(!JSON.stringify(summary).includes(clipboard));
    disk = await readFile(join(temporary, 'devices.json'), 'utf8');
    for (const marker of [typed, clipboard, image.slice(0, 100)]) assert.ok(!disk.includes(marker), marker.slice(0, 40));

    // The bounded cache keeps the last eight responses only.
    for (let index = 0; index < 8; index++) {
      const next = await registry.enqueue(device.device_id, 'windows_tool', { name: 'windows_snapshot', arguments: {} });
      await registry.poll(auth);
      await registry.result({ ...auth, jobId: next.jobId, result: { content: [{ type: 'text', text: `transient-${index}` }] } });
    }
    assert.equal(JSON.parse(registry.getJob(job.jobId).result.content[0].text).content_omitted, true);
    const oversized = await registry.enqueue(device.device_id, 'windows_tool', { name: 'windows_snapshot', arguments: {} });
    await registry.poll(auth);
    const rejected = await registry.result({ ...auth, jobId: oversized.jobId, result: { content: [{ type: 'image', mimeType: 'image/png', data: 'x'.repeat(2 * 1024 * 1024) }] } });
    assert.equal(rejected.status, 'failed');
    assert.equal(rejected.result.isError, true);

    const pending = await registry.enqueue(device.device_id, 'windows_tool', { name: 'windows_clipboard', arguments: { text: clipboard, mode: 'set' } });
    await registry.poll(auth);
    await registry.close();
    registry = await createDeviceRegistry({ stateDir: temporary });
    const restored = registry.getJob(job.jobId);
    assert.equal(JSON.parse(restored.result.content[0].text).content_omitted, true);
    assert.deepEqual(JSON.parse(restored.result.content[0].text).content_counts, { text: 1, image: 1 });
    assert.equal(registry.getJob(pending.jobId).status, 'cancelled');
    assert.equal(registry.getDevice(device.device_id).current_job_id, null);
    assert.equal((await registry.poll(auth)).job, null, 'uncertain desktop actions are not replayed after restart');
    disk = await readFile(join(temporary, 'devices.json'), 'utf8');
    for (const marker of [typed, clipboard, image.slice(0, 100)]) assert.ok(!disk.includes(marker), marker.slice(0, 40));
  } finally {
    await registry?.close().catch(() => {});
    await rm(temporary, { recursive: true, force: true });
  }
});
