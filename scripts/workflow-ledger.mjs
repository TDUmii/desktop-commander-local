import { appendFile, chmod, lstat, mkdir, open, readFile, stat, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

const SCHEMA_VERSION = 1;
const MAX_RECORDS = 500;
const MAX_EVENTS = 200;
const MAX_TEXT = 240;
const MAX_TITLE = 180;
const MAX_REQUEST_IDS = 50;
const MAX_JSON_BYTES = 256 * 1024;

const STATUSES = new Set(['queued', 'running', 'waiting', 'paused', 'review', 'blocked', 'done', 'archived', 'cancelled']);
const TERMINAL = new Set(['archived', 'cancelled']);
const TRANSITIONS = new Map([
  ['queued', new Set(['running', 'cancelled'])],
  ['running', new Set(['waiting', 'review', 'blocked', 'paused', 'done', 'cancelled'])],
  ['waiting', new Set(['running', 'review', 'blocked', 'paused', 'done', 'cancelled'])],
  ['paused', new Set(['running', 'cancelled'])],
  ['review', new Set(['running', 'blocked', 'paused', 'done', 'cancelled'])],
  ['blocked', new Set(['running', 'paused', 'cancelled'])],
  ['done', new Set(['archived'])],
  ['archived', new Set()],
  ['cancelled', new Set()],
]);

const now = () => new Date().toISOString();

function cleanText(value, max = MAX_TEXT, fallback = '') {
  if (value === undefined || value === null) return fallback;
  let text = String(value).replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  text = text.replace(/https?:\/\/[^\s]+/gi, '[redacted-url]');
  text = text.replace(/\b(token|secret|password|passwd|api[-_]?key|authorization)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]');
  return text.slice(0, max) || fallback;
}

function cleanKey(value, name) {
  const text = cleanText(value, 120);
  if (!text || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(text) || /https?:|\\|\//i.test(text)) {
    throw new Error(`invalid_${name}`);
  }
  return text;
}

function cleanRequestId(value) {
  const text = cleanText(value, 120);
  if (!text || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(text)) throw new Error('invalid_request_id');
  return text;
}

function cleanWorkflowId(value) {
  const text = cleanText(value, 120);
  if (!text || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(text)) throw new Error('invalid_workflow_id');
  return text;
}

function boundedHash(value) {
  const text = cleanText(value, 160);
  return text ? text.slice(0, 160) : null;
}

function safeBaselineHash(value) {
  const text = String(value ?? '').trim();
  if (/^[a-f0-9]{64}$/i.test(text)) return text.toLowerCase();
  return null;
}

function safeDispatchKey(value) {
  const text = cleanText(value, 120);
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(text) ? text : null;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const SENSITIVE_PAYLOAD_KEY = /^(content|data|input|text|value|message|args|arguments|password|secret|token|authorization|cookie|api[-_]?key)$/i;

function safePayload(value, depth = 0, key = '') {
  if (key && SENSITIVE_PAYLOAD_KEY.test(key)) return '[redacted for privacy]';
  if (depth > 3) return '[truncated]';
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return cleanText(value, MAX_TEXT);
  if (Array.isArray(value)) return value.slice(0, 20).map(item => safePayload(item, depth + 1));
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).slice(0, 30).map(([name, item]) => [cleanText(name, 80), safePayload(item, depth + 1, name)]));
  return cleanText(value, MAX_TEXT);
}

function makeDispatchKey(workflowId, requestIds, jobId = '') {
  return createHash('sha256').update(JSON.stringify({ workflowId, requestIds: [...requestIds].sort(), jobId })).digest('hex');
}

function normalizeRecord(input, { preserveId = false } = {}) {
  const workflowId = preserveId && input.workflow_id ? cleanWorkflowId(input.workflow_id) : `wf_${Date.now().toString(36)}_${randomUUID().replaceAll('-', '').slice(0, 16)}`;
  const requestIds = Array.isArray(input.request_ids ?? input.requestIds) ? input.request_ids ?? input.requestIds : [];
  const status = input.status ?? 'queued';
  if (!STATUSES.has(status)) throw new Error('invalid_workflow_status');
  const record = {
    workflow_id: workflowId,
    project_key: cleanKey(input.project_key ?? input.projectKey, 'project_key'),
    chat_key: cleanKey(input.chat_key ?? input.chatKey, 'chat_key'),
    title: cleanText(input.title, MAX_TITLE, 'Untitled workflow'),
    role: cleanText(input.role, 80, 'builder'),
    status,
    request_ids: requestIds.slice(0, MAX_REQUEST_IDS).map(cleanRequestId),
    job_id: input.job_id ?? input.jobId ? cleanText(input.job_id ?? input.jobId, 120) : null,
    parent_id: input.parent_id ?? input.parentId ? cleanWorkflowId(input.parent_id ?? input.parentId) : null,
    next_role: cleanText(input.next_role ?? input.nextRole, 80, null),
    next_task: cleanText(input.next_task ?? input.nextTask, MAX_TITLE, null),
    hop: Number.isSafeInteger(input.hop) && input.hop >= 0 && input.hop <= 1000 ? input.hop : 0,
    baseline_hash: safeBaselineHash(input.baseline_hash ?? input.baselineHash),
    dispatch_key: safeDispatchKey(input.dispatch_key ?? input.dispatchKey),
    version: Number.isSafeInteger(input.version) && input.version > 0 ? input.version : 1,
    created_at: typeof input.created_at === 'string' ? input.created_at : now(),
    updated_at: typeof input.updated_at === 'string' ? input.updated_at : now(),
    blocked_reason: cleanText(input.blocked_reason ?? input.blockedReason, MAX_TEXT, null),
    event_ids: Array.isArray(input.event_ids) ? input.event_ids.slice(-MAX_EVENTS).map(item => cleanText(item, 120)).filter(Boolean) : [],
  };
  if (record.status === 'blocked' && !record.blocked_reason) record.blocked_reason = 'blocked';
  if (record.status === 'archived' || record.status === 'cancelled') record.job_id = record.job_id ?? null;
  return record;
}

function snapshotLine(record, seq) {
  return { kind: 'workflow_snapshot', schema_version: SCHEMA_VERSION, seq, workflow: record };
}

function eventLine(event) {
  return { kind: 'workflow_event', schema_version: SCHEMA_VERSION, ...event };
}

export async function createWorkflowLedger(filePath, options = {}) {
  const enabled = options.enabled ?? process.env.UMIBRIDGE_WORKFLOWS === '1';
  await mkdir(dirname(filePath), { recursive: true });
  try {
    const info = await lstat(filePath);
    if (info.isSymbolicLink()) throw new Error('workflow_store_symlink');
    await chmod(filePath, 0o600);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const records = new Map();
  const events = new Map();
  const dispatches = new Map();
  let sequence = 0;
  try {
    const contents = await readFile(filePath, 'utf8');
    for (const line of contents.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const item = JSON.parse(line);
        if (!item || item.schema_version !== SCHEMA_VERSION) continue;
        if (Number.isSafeInteger(item.seq)) sequence = Math.max(sequence, item.seq);
        if (item.kind === 'workflow_snapshot' && item.workflow?.workflow_id) {
          try {
            const record = normalizeRecord(item.workflow, { preserveId: true });
            records.set(record.workflow_id, record);
            if (record.dispatch_key) dispatches.set(record.dispatch_key, record.workflow_id);
          } catch { /* Ignore tampered records. */ }
        } else if (item.kind === 'workflow_event' && item.event_id && item.workflow_id) {
          events.set(item.event_id, {
            event_id: cleanText(item.event_id, 120), workflow_id: cleanText(item.workflow_id, 120), seq: item.seq,
            type: cleanText(item.type, 80, 'event'), created_at: typeof item.created_at === 'string' ? item.created_at : now(),
            payload: safePayload(item.payload),
          });
        }
      } catch { /* Ignore malformed or incomplete journal lines, including a truncated tail. */ }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  for (const record of records.values()) {
    record.event_ids = record.event_ids.filter(eventId => events.has(eventId));
    if (record.dispatch_key) dispatches.set(record.dispatch_key, record.workflow_id);
  }
  let writes = Promise.resolve();
  const enqueue = task => {
    writes = writes.then(task, task);
    return writes;
  };
  const ensureEnabled = () => { if (!enabled) throw new Error('workflows_disabled'); };
  const lockPath = `${filePath}.lock`;
  const acquireLock = async () => {
    const deadline = Date.now() + 5_000;
    while (true) {
      try { return await open(lockPath, 'wx', 0o600); }
      catch (error) {
        if (error.code !== 'EEXIST') throw error;
        try {
          const existing = await stat(lockPath);
          if (Date.now() - existing.mtimeMs > 30_000) await unlink(lockPath);
        } catch (staleError) {
          if (staleError.code !== 'ENOENT') throw staleError;
        }
        if (Date.now() >= deadline) throw new Error('workflow_lock_timeout');
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
  };
  const persist = (record, event) => enqueue(async () => {
    const lines = [JSON.stringify(snapshotLine(record, sequence))];
    if (event) lines.push(JSON.stringify(eventLine(event)));
    const lock = await acquireLock();
    try { await appendFile(filePath, `${lines.join('\n')}\n`, { encoding: 'utf8', mode: 0o600 }); }
    finally { await lock.close(); await unlink(lockPath).catch(() => {}); }
  });
  const reloadFromDisk = async () => {
    const freshRecords = new Map();
    const freshEvents = new Map();
    const freshDispatches = new Map();
    let freshSequence = 0;
    let contents;
    try { contents = await readFile(filePath, 'utf8'); }
    catch (error) { if (error.code === 'ENOENT') return; throw error; }
    for (const line of contents.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const item = JSON.parse(line);
        if (!item || item.schema_version !== SCHEMA_VERSION) continue;
        if (Number.isSafeInteger(item.seq)) freshSequence = Math.max(freshSequence, item.seq);
        if (item.kind === 'workflow_snapshot' && item.workflow?.workflow_id) {
          try {
            const record = normalizeRecord(item.workflow, { preserveId: true });
            freshRecords.set(record.workflow_id, record);
            if (record.dispatch_key) freshDispatches.set(record.dispatch_key, record.workflow_id);
          } catch { /* Ignore tampered records. */ }
        } else if (item.kind === 'workflow_event' && item.event_id && item.workflow_id) {
          freshEvents.set(item.event_id, {
            event_id: cleanText(item.event_id, 120), workflow_id: cleanText(item.workflow_id, 120), seq: item.seq,
            type: cleanText(item.type, 80, 'event'), created_at: typeof item.created_at === 'string' ? item.created_at : now(),
            payload: safePayload(item.payload),
          });
        }
      } catch { /* Ignore malformed and incomplete journal lines. */ }
    }
    for (const record of freshRecords.values()) record.event_ids = record.event_ids.filter(eventId => freshEvents.has(eventId));
    records.clear(); events.clear(); dispatches.clear();
    for (const [id, record] of freshRecords) records.set(id, record);
    for (const [id, event] of freshEvents) events.set(id, event);
    for (const [key, id] of freshDispatches) dispatches.set(key, id);
    sequence = freshSequence;
  };
  const appendLocked = async (record, event) => {
    const lines = [JSON.stringify(snapshotLine(record, sequence))];
    if (event) lines.push(JSON.stringify(eventLine(event)));
    await appendFile(filePath, `${lines.join('\n')}\n`, { encoding: 'utf8', mode: 0o600 });
  };
  const recordEvent = (record, type, payload = {}, metadata = {}) => {
    sequence++;
    const requestedId = typeof metadata.eventId === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(metadata.eventId)
      ? metadata.eventId : null;
    const event = {
      event_id: requestedId && !events.has(requestedId) ? requestedId : `evt_${sequence.toString(36)}_${randomUUID().replaceAll('-', '').slice(0, 12)}`,
      workflow_id: record.workflow_id,
      seq: sequence,
      type: cleanText(type, 80, 'event'),
      created_at: typeof metadata.createdAt === 'string' && Number.isFinite(Date.parse(metadata.createdAt)) ? metadata.createdAt : now(),
      payload: safePayload(payload),
    };
    events.set(event.event_id, event);
    record.event_ids = [...record.event_ids, event.event_id].slice(-MAX_EVENTS);
    return event;
  };
  const getRecord = workflowId => {
    const id = cleanWorkflowId(workflowId);
    const record = records.get(id);
    if (!record) throw new Error('workflow_not_found');
    return record;
  };
  const publicRecord = record => clone(record);

  return {
    enabled,
    list(filter = {}) {
      if (!enabled) return [];
      const options = typeof filter === 'number' ? { limit: filter } : (filter ?? {});
      const limit = Math.min(Math.max(Number(options.limit) || MAX_RECORDS, 1), MAX_RECORDS);
      return [...records.values()]
        .filter(item => !options.projectKey && !options.project_key || item.project_key === (options.projectKey ?? options.project_key))
        .filter(item => !options.chatKey && !options.chat_key || item.chat_key === (options.chatKey ?? options.chat_key))
        .filter(item => !options.status || item.status === options.status)
        .filter(item => !Number.isFinite(Date.parse(options.from)) || Date.parse(item.updated_at) >= Date.parse(options.from))
        .filter(item => !Number.isFinite(Date.parse(options.to)) || Date.parse(item.updated_at) <= Date.parse(options.to))
        .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
        .slice(0, limit).map(publicRecord);
    },
    async get(workflowId) {
      if (!enabled) return null;
      try { return publicRecord(getRecord(workflowId)); } catch (error) { if (error.message === 'workflow_not_found') return null; throw error; }
    },
    async create(input = {}) {
      ensureEnabled();
      return enqueue(async () => {
        const lock = await acquireLock();
        try {
          await reloadFromDisk();
          if (records.size >= MAX_RECORDS) throw new Error('workflow_limit');
          if (input.status !== undefined && input.status !== 'queued') throw new Error('invalid_initial_status');
          const record = normalizeRecord(input);
          if (!record.request_ids.length) record.request_ids = [];
          const event = recordEvent(record, 'created', { status: record.status });
          records.set(record.workflow_id, record);
          if (record.dispatch_key) dispatches.set(record.dispatch_key, record.workflow_id);
          await appendLocked(record, event);
          return publicRecord(record);
        } finally {
          await lock.close();
          await unlink(lockPath).catch(() => {});
        }
      });
    },
    async update(workflowId, patch = {}, expectedVersion) {
      ensureEnabled();
      return enqueue(async () => {
        const lock = await acquireLock();
        try {
          await reloadFromDisk();
          const record = getRecord(workflowId);
          if (TERMINAL.has(record.status)) throw new Error('terminal_workflow');
          const expected = expectedVersion ?? patch.expectedVersion;
          if (expected !== undefined && expected !== record.version) throw new Error('workflow_version_conflict');
          const nextStatus = patch.status ?? record.status;
          if (!STATUSES.has(nextStatus)) throw new Error('invalid_workflow_status');
          if (nextStatus !== record.status && !TRANSITIONS.get(record.status)?.has(nextStatus)) throw new Error('invalid workflow transition');
          const allowed = ['title', 'role', 'next_role', 'nextRole', 'next_task', 'nextTask', 'hop', 'blocked_reason', 'blockedReason', 'parent_id', 'parentId', 'baseline_hash', 'baselineHash', 'request_ids', 'requestIds'];
          for (const key of allowed) if (patch[key] !== undefined) {
            const value = patch[key];
            if (key === 'request_ids' || key === 'requestIds') record.request_ids = (Array.isArray(value) ? value : []).slice(0, MAX_REQUEST_IDS).map(cleanRequestId);
            else if (key === 'hop') record.hop = Number.isSafeInteger(value) && value >= 0 && value <= 1000 ? value : record.hop;
            else if (key === 'parent_id' || key === 'parentId') {
              const candidate = value ? cleanWorkflowId(value) : null;
              const seen = new Set();
              let cursor = candidate;
              while (cursor) {
                if (cursor === record.workflow_id || seen.has(cursor)) throw new Error('workflow_parent_cycle');
                seen.add(cursor);
                cursor = records.get(cursor)?.parent_id ?? null;
              }
              record.parent_id = candidate;
            }
            else if (key === 'baseline_hash' || key === 'baselineHash') record.baseline_hash = safeBaselineHash(value);
            else if (key === 'next_role' || key === 'nextRole') record.next_role = cleanText(value, 80, null);
            else if (key === 'next_task' || key === 'nextTask') record.next_task = cleanText(value, MAX_TITLE, null);
            else if (key === 'blocked_reason' || key === 'blockedReason') record.blocked_reason = cleanText(value, MAX_TEXT, null);
            else if (key === 'title') record.title = cleanText(value, MAX_TITLE, record.title);
            else if (key === 'role') record.role = cleanText(value, 80, record.role);
          }
          record.status = nextStatus;
          if (nextStatus === 'running' && patch.blockedReason === undefined && patch.blocked_reason === undefined) record.blocked_reason = null;
          if (nextStatus === 'blocked' && !record.blocked_reason) record.blocked_reason = 'blocked';
          record.version++;
          record.updated_at = now();
          const event = recordEvent(record, 'updated', { status: record.status, version: record.version });
          await appendLocked(record, event);
          return publicRecord(record);
        } finally {
          await lock.close();
          await unlink(lockPath).catch(() => {});
        }
      });
    },
    async linkJob(workflowId, input = {}) {
      ensureEnabled();
      return enqueue(async () => {
        const lock = await acquireLock();
        try {
          await reloadFromDisk();
          const record = getRecord(workflowId);
          const expected = input.expectedVersion;
          if (expected !== undefined && expected !== record.version) throw new Error('workflow_version_conflict');
          if (TERMINAL.has(record.status)) throw new Error('invalid workflow transition');
          let jobId;
          try { jobId = cleanKey(input.jobId ?? input.job_id, 'job_id'); } catch { throw new Error('invalid_job_id'); }
          const dispatchKey = safeDispatchKey(input.dispatchKey ?? input.dispatch_key) || makeDispatchKey(record.workflow_id, record.request_ids, jobId);
          const owner = dispatches.get(dispatchKey);
          if (owner && owner !== record.workflow_id) throw new Error('dispatch_conflict');
          if (record.dispatch_key === dispatchKey) return { ...publicRecord(record), idempotent: true };
          if (record.job_id || record.dispatch_key) {
            if (record.job_id === jobId && record.dispatch_key === dispatchKey) return { ...publicRecord(record), idempotent: true };
            throw new Error('dispatch_conflict');
          }
          record.job_id = jobId;
          record.dispatch_key = dispatchKey;
          record.baseline_hash = safeBaselineHash(input.baselineHash ?? input.baseline_hash) || record.baseline_hash || makeDispatchKey(record.workflow_id, record.request_ids);
          record.version++;
          record.updated_at = now();
          dispatches.set(dispatchKey, record.workflow_id);
          const event = recordEvent(record, 'job_linked', { job_id: jobId, dispatch_key: dispatchKey });
          await appendLocked(record, event);
          return { ...publicRecord(record), idempotent: false };
        } finally {
          await lock.close();
          await unlink(lockPath).catch(() => {});
        }
      });
    },
    async appendEvent(workflowId, type, payload = {}) {
      ensureEnabled();
      return enqueue(async () => {
        const lock = await acquireLock();
        try {
          await reloadFromDisk();
          const record = getRecord(workflowId);
          if (TERMINAL.has(record.status)) throw new Error('terminal_workflow');
          const event = recordEvent(record, type, payload);
          record.version++;
          record.updated_at = now();
          await appendLocked(record, event);
          return clone(event);
        } finally {
          await lock.close();
          await unlink(lockPath).catch(() => {});
        }
      });
    },
    async getEvents(workflowId) {
      if (!enabled) return [];
      const record = getRecord(workflowId);
      return record.event_ids.map(eventId => events.get(eventId)).filter(Boolean).map(clone);
    },
    async events(workflowId) {
      return this.getEvents(workflowId);
    },
    async recover() {
      ensureEnabled();
      return enqueue(async () => {
        const lock = await acquireLock();
        try {
          await reloadFromDisk();
          let changed = 0;
          for (const record of records.values()) {
            if (record.status !== 'running') continue;
            record.status = 'waiting';
            record.blocked_reason = 'gateway_restart';
            record.version++;
            record.updated_at = now();
            const event = recordEvent(record, 'recovered', { reason: 'gateway_restart' });
            await appendLocked(record, event);
            changed++;
          }
          return { changed };
        } finally {
          await lock.close();
          await unlink(lockPath).catch(() => {});
        }
      });
    },
    async exportData() {
      ensureEnabled();
      const data = {
        schema_version: SCHEMA_VERSION,
        exported_at: now(),
        workflows: [...records.values()].map(record => {
          const safe = publicRecord(record);
          delete safe.dispatch_key;
          safe.events = record.event_ids.map(id => events.get(id)).filter(Boolean).map(event => ({ event_id: event.event_id, type: event.type, created_at: event.created_at, payload: safePayload(event.payload) }));
          delete safe.event_ids;
          return safe;
        }),
      };
      if (Buffer.byteLength(JSON.stringify(data), 'utf8') > MAX_JSON_BYTES) throw new Error('workflow_export_too_large');
      return data;
    },
    async importData(input) {
      ensureEnabled();
      let data = input;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch { throw new Error('invalid_workflow_import'); }
      }
      if (!data || data.schema_version !== SCHEMA_VERSION || !Array.isArray(data.workflows)) throw new Error('invalid_workflow_import');
      if (Buffer.byteLength(JSON.stringify(data), 'utf8') > MAX_JSON_BYTES) throw new Error('workflow_import_too_large');
      let imported = 0, skipped = 0;
      for (const item of data.workflows.slice(0, MAX_RECORDS)) {
        const importInput = { ...item, dispatch_key: null, job_id: null };
        if (importInput.status === 'running') {
          importInput.status = 'waiting';
          importInput.blocked_reason = 'import_requires_resume';
        }
        const record = normalizeRecord(importInput, { preserveId: true });
        if (records.has(record.workflow_id)) { skipped++; continue; }
        records.set(record.workflow_id, record);
        const importedEvents = Array.isArray(item.events) ? item.events.slice(-MAX_EVENTS) : [];
        if (importedEvents.length) {
          for (const itemEvent of importedEvents) {
            const event = recordEvent(record, itemEvent?.type, itemEvent?.payload ?? {}, { eventId: itemEvent?.event_id, createdAt: itemEvent?.created_at });
            await persist(record, event);
          }
        } else {
          const event = recordEvent(record, 'imported', { source: 'workflow_export' });
          await persist(record, event);
        }
        imported++;
      }
      return { imported, skipped };
    },
    async close() { await writes; },
  };
}

export { makeDispatchKey };
