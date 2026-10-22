import { EventEmitter } from 'node:events';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const STATE_VERSION = 1;
const MAX_DEVICES = 100;
const MAX_JOBS = 500;
const MAX_PAIRINGS = 100;
const PAIRING_TTL_MS = 10 * 60_000;
const OFFLINE_AFTER_MS = 15_000;
const MAX_RESULT_BYTES = 256_000;

const now = () => Date.now();
const iso = value => new Date(value).toISOString();
const hashSecret = value => createHash('sha256').update(value).digest('base64url');
const randomKey = () => randomBytes(32).toString('base64url');
const pairingCode = () => randomBytes(6).toString('hex').slice(0, 10).toUpperCase();
const cleanText = (value, fallback = '') => {
  const text = String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  return text.slice(0, 180) || fallback;
};

function sameSecret(left, right) {
  const a = Buffer.from(left ?? '');
  const b = Buffer.from(right ?? '');
  return a.length === b.length && timingSafeEqual(a, b);
}

function boundedResult(value) {
  try {
    const encoded = JSON.stringify(value ?? null);
    if (encoded.length <= MAX_RESULT_BYTES) return value;
  } catch { /* Fall through to a small error payload. */ }
  return {
    isError: true,
    content: [{ type: 'text', text: JSON.stringify({ error: 'The device result exceeded the history limit.', truncated: true }) }],
  };
}

function statusFor(device) {
  return device.lastSeen && now() - device.lastSeen <= OFFLINE_AFTER_MS ? 'online' : 'offline';
}

function safeDevice(device) {
  return {
    device_id: device.deviceId,
    name: device.name,
    hostname: device.hostname,
    platform: device.platform,
    version: device.version,
    status: statusFor(device),
    last_seen: device.lastSeen ? iso(device.lastSeen) : null,
    created_at: iso(device.createdAt),
    capabilities: Array.isArray(device.capabilities) ? device.capabilities : [],
    current_job_id: device.currentJobId ?? null,
  };
}

function safeJob(job) {
  return {
    job_id: job.jobId,
    device_id: job.deviceId,
    tool: job.tool,
    status: job.status,
    created_at: iso(job.createdAt),
    started_at: job.startedAt ? iso(job.startedAt) : null,
    finished_at: job.finishedAt ? iso(job.finishedAt) : null,
    result: job.result ?? null,
    error: job.error ?? null,
  };
}

/**
 * Small persisted hub registry for one account and many Windows agents.
 * Agent credentials are stored as hashes; the raw key is returned only once
 * during pairing and is written by the agent to its protected local state.
 */
export async function createDeviceRegistry({ stateDir } = {}) {
  if (!stateDir) throw new Error('stateDir is required.');
  await mkdir(stateDir, { recursive: true });
  const filePath = join(stateDir, 'devices.json');
  let state = { version: STATE_VERSION, devices: [], pairings: [], jobs: [] };
  try {
    const loaded = JSON.parse(await readFile(filePath, 'utf8'));
    if (loaded?.version !== STATE_VERSION || !Array.isArray(loaded.devices) || !Array.isArray(loaded.jobs)) {
      throw new Error('Unsupported device registry format.');
    }
    state = {
      version: STATE_VERSION,
      devices: loaded.devices,
      pairings: Array.isArray(loaded.pairings) ? loaded.pairings : [],
      jobs: loaded.jobs,
    };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const events = new EventEmitter();
  let writes = Promise.resolve();
  const save = () => {
    writes = writes.then(async () => {
      const temporary = `${filePath}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
      await writeFile(temporary, JSON.stringify(state, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
      await rename(temporary, filePath);
    }, async () => {
      const temporary = `${filePath}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
      await writeFile(temporary, JSON.stringify(state, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
      await rename(temporary, filePath);
    });
    return writes;
  };
  const prune = () => {
    const cutoff = now();
    state.pairings = state.pairings.filter(item => item.expiresAt > cutoff).slice(-MAX_PAIRINGS);
    state.jobs = state.jobs.slice(-MAX_JOBS);
  };
  const findDevice = deviceId => state.devices.find(item => item.deviceId === deviceId);
  const authenticate = (deviceId, key) => {
    const device = findDevice(deviceId);
    if (!device || !sameSecret(device.keyHash, hashSecret(key))) throw new Error('Invalid agent credential.');
    return device;
  };
  const touch = async (device, payload = {}) => {
    device.lastSeen = now();
    if (payload.hostname) device.hostname = cleanText(payload.hostname, device.hostname);
    if (payload.platform) device.platform = cleanText(payload.platform, device.platform);
    if (payload.version) device.version = cleanText(payload.version, device.version);
    if (Array.isArray(payload.capabilities)) device.capabilities = payload.capabilities.map(value => cleanText(value)).filter(Boolean).slice(0, 50);
    await save();
  };
  const createJob = async (deviceId, tool, args) => {
    prune();
    const device = findDevice(deviceId);
    if (!device) throw new Error('Unknown device. Pair it from the local dashboard first.');
    if (statusFor(device) !== 'online') throw new Error(`Device ${deviceId} is offline.`);
    const job = {
      jobId: `job_${Date.now().toString(36)}_${randomBytes(5).toString('hex')}`,
      deviceId,
      tool,
      args: args ?? {},
      status: 'queued',
      createdAt: now(),
      startedAt: null,
      finishedAt: null,
      result: null,
      error: null,
    };
    state.jobs.push(job);
    await save();
    events.emit('job', job.jobId);
    return job;
  };
  const getJob = jobId => state.jobs.find(item => item.jobId === jobId);

  return {
    async createPairing(label = '') {
      prune();
      if (state.devices.length >= MAX_DEVICES) throw new Error(`The hub supports up to ${MAX_DEVICES} devices.`);
      const code = pairingCode();
      state.pairings.push({ codeHash: hashSecret(code), label: cleanText(label), createdAt: now(), expiresAt: now() + PAIRING_TTL_MS });
      await save();
      return { code, expiresAt: iso(now() + PAIRING_TTL_MS) };
    },

    async pair(payload = {}) {
      prune();
      const code = cleanText(payload.code).replace(/\s+/g, '').toUpperCase();
      const codeHash = hashSecret(code);
      const index = state.pairings.findIndex(item => sameSecret(item.codeHash, codeHash) && item.expiresAt > now());
      if (index < 0) throw new Error('Pairing code is invalid or expired.');
      state.pairings.splice(index, 1);
      const agentKey = randomKey();
      const device = {
        deviceId: `device-${randomBytes(6).toString('hex')}`,
        name: cleanText(payload.name, `Windows device ${state.devices.length + 1}`),
        hostname: cleanText(payload.hostname, 'Unknown host'),
        platform: cleanText(payload.platform, 'windows'),
        version: cleanText(payload.version, 'unknown'),
        keyHash: hashSecret(agentKey),
        createdAt: now(),
        lastSeen: null,
        capabilities: Array.isArray(payload.capabilities) ? payload.capabilities.map(value => cleanText(value)).filter(Boolean).slice(0, 50) : [],
        currentJobId: null,
      };
      state.devices.push(device);
      await save();
      return { device_id: device.deviceId, agent_key: agentKey, name: device.name };
    },

    async poll({ deviceId, agentKey, ...metadata } = {}) {
      const device = authenticate(deviceId, agentKey);
      await touch(device, metadata);
      prune();
      const job = state.jobs.find(item => item.deviceId === deviceId && item.status === 'queued');
      if (!job) return { job: null, server_time: new Date().toISOString() };
      job.status = 'running';
      job.startedAt = now();
      device.currentJobId = job.jobId;
      await save();
      return { job: { job_id: job.jobId, tool: job.tool, arguments: job.args }, server_time: new Date().toISOString() };
    },

    async result({ deviceId, agentKey, jobId, result, error } = {}) {
      const device = authenticate(deviceId, agentKey);
      await touch(device);
      const job = getJob(jobId);
      if (!job || job.deviceId !== deviceId) throw new Error('Unknown job for this device.');
      if (['completed', 'failed', 'cancelled'].includes(job.status)) return safeJob(job);
      job.result = boundedResult(result);
      job.error = error ? cleanText(error) : null;
      job.status = error || result?.isError ? 'failed' : 'completed';
      job.finishedAt = now();
      if (device.currentJobId === job.jobId) device.currentJobId = null;
      await save();
      events.emit('job', job.jobId);
      return safeJob(job);
    },

    async heartbeat({ deviceId, agentKey, ...metadata } = {}) {
      const device = authenticate(deviceId, agentKey);
      await touch(device, metadata);
      return { ok: true, server_time: new Date().toISOString() };
    },

    listDevices() {
      prune();
      return state.devices.map(safeDevice);
    },

    getDevice(deviceId) {
      const device = findDevice(deviceId);
      if (!device) throw new Error('Unknown device.');
      return safeDevice(device);
    },

    async revokeDevice(deviceId) {
      const index = state.devices.findIndex(item => item.deviceId === deviceId);
      if (index < 0) throw new Error('Unknown device.');
      state.devices.splice(index, 1);
      for (const job of state.jobs) if (job.deviceId === deviceId && ['queued', 'running'].includes(job.status)) {
        job.status = 'cancelled'; job.error = 'Device was revoked.'; job.finishedAt = now();
      }
      await save();
      return { ok: true, device_id: deviceId };
    },

    listJobs({ deviceId, limit = 50 } = {}) {
      prune();
      const max = Math.min(Math.max(Number(limit) || 50, 1), 100);
      return state.jobs.filter(job => !deviceId || job.deviceId === deviceId).slice(-max).reverse().map(safeJob);
    },

    getJob(jobId) {
      const job = getJob(jobId);
      if (!job) throw new Error('Unknown job.');
      return safeJob(job);
    },

    async waitForJob(jobId, timeoutMs = 120_000) {
      const existing = getJob(jobId);
      if (!existing) throw new Error('Unknown job.');
      if (['completed', 'failed', 'cancelled'].includes(existing.status)) return safeJob(existing);
      return new Promise(resolve => {
        const finish = () => {
          const current = getJob(jobId);
          if (current && ['completed', 'failed', 'cancelled'].includes(current.status)) {
            clearTimeout(timer); events.off('job', onJob); resolve(safeJob(current));
          }
        };
        const onJob = changedId => { if (changedId === jobId) finish(); };
        const timer = setTimeout(() => { events.off('job', onJob); resolve(null); }, Math.min(Math.max(Number(timeoutMs) || 120_000, 1000), 120_000));
        events.on('job', onJob);
        finish();
      });
    },

    async enqueue(deviceId, tool, args) {
      return createJob(deviceId, tool, args);
    },

    async close() {
      await save();
      events.removeAllListeners();
    },
  };
}

export { OFFLINE_AFTER_MS };
