import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
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
