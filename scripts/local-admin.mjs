import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createReadStream, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { homedir } from 'node:os';
import { dirname } from 'node:path';

const MAX_ENTRIES = 500;
const MAX_TEXT = 500;
const MAX_COMMAND_OUTPUT = 12_000;
const sensitiveKey = /^(content|data|input|password|secret|token|authorization|cookie)$/i;
const home = homedir().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const homePattern = home ? new RegExp(home, 'ig') : null;
const outputSecretPattern = /((?:authorization\s*:\s*bearer|password|passwd|token|secret|api[-_]?key|cookie)\s*[:=]\s*)([^\s,;]+)/ig;

function safeString(value) {
  const text = String(value).replace(homePattern ?? /$^/, '~');
  return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}…` : text;
}

function safeArguments(value, key, depth = 0, sanitize = safeString) {
  if (key && sensitiveKey.test(key)) return '[redacted for privacy]';
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return sanitize(value);
  if (depth >= 3) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 20).map(item => safeArguments(item, key, depth + 1, sanitize));
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).slice(0, 30).map(([name, item]) => [sanitize(name), safeArguments(item, name, depth + 1, sanitize)]));
  }
  return String(value);
}

function outputFor(result, safeOutput) {
  const text = result?.content?.find(item => item?.type === 'text')?.text;
  if (typeof text !== 'string' || !text) return null;
  try {
    const payload = JSON.parse(text);
    if (payload && typeof payload === 'object' && ('stdout' in payload || 'stderr' in payload || 'exit_code' in payload)) {
      return {
        exitCode: Number.isInteger(payload.exit_code) ? payload.exit_code : null,
        timedOut: Boolean(payload.timed_out),
        stdout: safeOutput(payload.stdout),
        stderr: safeOutput(payload.stderr),
      };
    }
  } catch { /* Keep non-JSON tool errors as a bounded output message. */ }
  return { exitCode: null, timedOut: Boolean(result?.isError), stdout: safeOutput(text), stderr: '' };
}

// This bridge sees tool payloads, not the provider's model billing or chat context.
function estimateUsage(toolName, args, result) {
  const count = value => Math.ceil(Buffer.byteLength(JSON.stringify(value), 'utf8') / 4);
  const inputTokens = count({ name: toolName, arguments: args ?? {} });
  const outputTokens = count((result?.content ?? []).filter(item => item?.type === 'text'));
  return { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens, estimated: true, method: 'utf8-bytes/4' };
}

function measuredUsage(entry) {
  const usage = entry?.usage;
  return usage?.estimated === true && usage.method === 'utf8-bytes/4' &&
    ['inputTokens', 'outputTokens', 'totalTokens'].every(key => Number.isSafeInteger(usage[key]) && usage[key] >= 0) &&
    usage.totalTokens === usage.inputTokens + usage.outputTokens ? usage : null;
}

function recordFor(toolName, args, result, duration, safeOutput, clientName) {
  const sanitize = value => safeString(safeOutput(value));
  // DCR names are self-declared display labels, never authorization rules.
  const name = safeOutput(typeof clientName === 'string' ? clientName : '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 120);
  const provider = /\b(?:gemini|google)\b/i.test(name) ? 'gemini' : /\b(?:chatgpt|openai)\b/i.test(name) ? 'chatgpt' : 'other';
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    toolName: sanitize(toolName),
    arguments: safeArguments(args, undefined, 0, sanitize),
    status: result?.isError ? 'error' : 'ok',
    contentItems: Array.isArray(result?.content) ? result.content.length : 0,
    durationMs: Math.max(0, Math.round(duration)),
    provider,
    clientName: name || 'Unknown app',
    usage: estimateUsage(toolName, args, result),
  };
  if (toolName === 'run_command') {
    entry.command = sanitize(args?.command ?? '');
    entry.cwd = sanitize(args?.cwd ?? 'project root');
    entry.output = outputFor(result, safeOutput);
  }
  return entry;
}

export async function createRequestHistory(filePath, { secretValues = [] } = {}) {
  const secretPatterns = secretValues.filter(value => typeof value === 'string' && value.length >= 8)
    .map(value => new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'));
  const safeOutput = value => {
    let text = String(value ?? '').replace(homePattern ?? /$^/, '~').replace(outputSecretPattern, '$1[redacted]');
    for (const pattern of secretPatterns) text = text.replace(pattern, '[redacted]');
    if (text.length > MAX_COMMAND_OUTPUT) return `${text.slice(0, MAX_COMMAND_OUTPUT)}\n[output truncated]`;
    return text;
  };
  await mkdir(dirname(filePath), { recursive: true });
  let entries = [];
  let received = { total: 0, success: 0, errors: 0 };
  const emptyUsage = () => ({ inputTokens: 0, outputTokens: 0, totalTokens: 0, measuredRequests: 0 });
  let tokenTotals = emptyUsage();
  let tokenProviders = new Map();
  const retain = entry => {
    received.total++;
    if (entry.status === 'ok') received.success++; else received.errors++;
    const usage = measuredUsage(entry);
    if (usage) {
      const provider = ['chatgpt', 'gemini'].includes(entry.provider) ? entry.provider : 'other';
      const group = tokenProviders.get(provider) ?? emptyUsage();
      for (const key of ['inputTokens', 'outputTokens', 'totalTokens']) {
        tokenTotals[key] += usage[key];
        group[key] += usage[key];
      }
      tokenTotals.measuredRequests++;
      group.measuredRequests++;
      tokenProviders.set(provider, group);
    }
    entries.push(entry);
    if (entries.length > MAX_ENTRIES) entries.shift();
  };
  try {
    // Restore totals without loading the growing journal into memory.
    const lines = createInterface({ input: createReadStream(filePath, { encoding: 'utf8' }), crlfDelay: Infinity });
    for await (const line of lines) {
      try {
        const item = JSON.parse(line);
        if (item?.id && item?.timestamp && item?.toolName) retain(item);
      } catch { /* Ignore incomplete or invalid journal lines. */ }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  let writes = Promise.resolve();
  const enqueue = task => {
    writes = writes.then(task, task);
    return writes;
  };
  return {
    add(toolName, args, result, duration, clientName) {
      const entry = recordFor(toolName, args, result, duration, safeOutput, clientName);
      retain(entry);
      return enqueue(() => appendFile(filePath, `${JSON.stringify(entry)}\n`, 'utf8'));
    },
    list(limit = 200) {
      const safeLimit = Math.min(Math.max(Number(limit) || 0, 0), MAX_ENTRIES);
      return entries.slice(-safeLimit).reverse();
    },
    has(requestId) { return entries.some(entry => entry.id === requestId); },
    stats() {
      const tools = new Set(entries.map(entry => entry.toolName));
      const success = entries.filter(entry => entry.status === 'ok').length;
      const errors = entries.length - success;
      const elapsed = entries.map(entry => entry.durationMs).sort((a, b) => a - b);
      const averageMs = elapsed.length ? Math.round(elapsed.reduce((a, b) => a + b, 0) / elapsed.length) : null;
      const p95Ms = elapsed.length ? elapsed[Math.ceil(elapsed.length * .95) - 1] : null;
      const toolCounts = new Map();
      for (const entry of entries) {
        const name = entry.toolName;
        const current = toolCounts.get(name) ?? { name, count: 0, errors: 0, totalDuration: 0, ...emptyUsage() };
        current.count++;
        current.errors += entry.status === 'ok' ? 0 : 1;
        current.totalDuration += entry.durationMs;
        const usage = measuredUsage(entry);
        if (usage) {
          for (const key of ['inputTokens', 'outputTokens', 'totalTokens']) current[key] += usage[key];
          current.measuredRequests++;
        }
        toolCounts.set(name, current);
      }
      const toolBreakdown = [...toolCounts.values()].sort((a, b) => b.count - a.count);
      const recent24h = entries.filter(entry => Date.now() - Date.parse(entry.timestamp) <= 86400_000 && Date.now() >= Date.parse(entry.timestamp)).length;
      const hourly = [];
      const now = new Date();
      const currentHour = Math.floor(now.getTime() / 3600_000);
      for (let offset = 11; offset >= 0; offset--) {
        const start = (currentHour - offset) * 3600_000;
        hourly.push({ hour: new Date(start).toISOString(), count: entries.filter(entry => {
          const ms = Date.parse(entry.timestamp);
          return ms >= start && ms < start + 3600_000;
        }).length });
      }
      const tokens = { ...tokenTotals, unmeasuredRequests: received.total - tokenTotals.measuredRequests,
        estimated: true, method: 'utf8-bytes/4', scope: 'text-tool-payloads',
        byProvider: [...tokenProviders].map(([provider, usage]) => ({ provider, ...usage })),
        recentTools: toolBreakdown.filter(tool => tool.measuredRequests).sort((a,b) => b.totalTokens - a.totalTokens).slice(0, 6) };
      return { total: entries.length, received: { ...received }, tokens, historyLimit: MAX_ENTRIES, tools: tools.size, latest: entries.at(-1)?.timestamp ?? null,
        success, errors, averageMs, p95Ms, recent24h, toolBreakdown, hourly };
    },
    clear() {
      entries = [];
      received = { total: 0, success: 0, errors: 0 };
      tokenTotals = emptyUsage();
      tokenProviders = new Map();
      return enqueue(() => writeFile(filePath, '', 'utf8'));
    },
  };
}


/** Optional, user-entered conversation links. The MCP protocol does not expose chat IDs. */
export function parseChatLink(raw) {
  if (typeof raw !== 'string' || raw.length > 500) throw new Error('Provide a valid ChatGPT or Gemini conversation URL.');
  let url;
  try { url = new URL(raw.trim()); } catch { throw new Error('Use a full ChatGPT or Gemini HTTPS URL.'); }
  if (url.hostname === 'g.co') {
    // Gemini copies this official short URL; keep validation local and never follow redirects.
    const shared = raw.trim().match(/^https:\/\/g\.co\/gemini\/share\/([a-zA-Z0-9_-]{6,100})\/?$/);
    if (!shared) throw new Error('The URL must point to a ChatGPT conversation (/c/...), Gemini conversation (/app/...) or shared chat (/share/...).');
    return { chatId: shared[1], chatUrl: `https://g.co/gemini/share/${shared[1]}`, kind: 'shared', provider: 'gemini' };
  }
  if (url.protocol !== 'https:' ||
      !['chatgpt.com', 'chat.openai.com', 'gemini.google.com'].includes(url.hostname) ||
      url.username || url.password || url.port || url.search || url.hash) {
    throw new Error('Only HTTPS links from chatgpt.com, chat.openai.com or gemini.google.com are accepted, without query parameters.');
  }
  const provider = url.hostname === 'gemini.google.com' ? 'gemini' : 'chatgpt';
  const match = provider === 'gemini'
    ? url.pathname.match(/^\/(?:app\/([a-fA-F0-9]{6,100})|share\/([a-zA-Z0-9_-]{6,100}))\/?$/)
    : url.pathname.match(/^\/(?:g\/[a-zA-Z0-9_-]+\/)?(?:c|share)\/([a-zA-Z0-9_-]{6,100})\/?$/);
  if (!match) throw new Error('The URL must point to a ChatGPT conversation (/c/...), Gemini conversation (/app/...) or shared chat (/share/...).');
  return { chatId: match[1] || match[2], chatUrl: url.origin + url.pathname.replace(/\/$/, ''), kind: url.pathname.includes('/share/') ? 'shared' : 'conversation', provider };
}

export async function createChatLinksStore(filePath) {
  await mkdir(dirname(filePath), { recursive: true });
  let links = new Map();
  try {
    const stored = JSON.parse(await readFile(filePath, 'utf8'));
    if (Array.isArray(stored)) {
      for (const entry of stored.slice(-MAX_ENTRIES)) {
        if (typeof entry?.requestId !== 'string' || entry.requestId.length > 120) continue;
        try {
          links.set(entry.requestId, { requestId: entry.requestId, ...parseChatLink(entry.chatUrl), linkedAt: entry.linkedAt || null });
        } catch { /* Ignore tampered or obsolete entries. */ }
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
  }
  let pendingWrite = Promise.resolve();
  const persist = () => {
    const snapshot = JSON.stringify([...links.values()]);
    pendingWrite = pendingWrite.then(() => writeFile(filePath, snapshot, { encoding: 'utf8', mode: 0o600 }));
    return pendingWrite;
  };
  return {
    list() { return [...links.values()]; },
    async set(requestId, rawUrl) {
      if (typeof requestId !== 'string' || !/^[a-zA-Z0-9_-]{6,120}$/.test(requestId)) throw new Error('Invalid request ID.');
      const parsed = parseChatLink(rawUrl);
      links.set(requestId, { requestId, ...parsed, linkedAt: new Date().toISOString() });
      if (links.size > MAX_ENTRIES) links.delete(links.keys().next().value);
      await persist();
      return links.get(requestId);
    },
    async unlink(requestId) { links.delete(requestId); await persist(); },
    async clear() { links.clear(); await persist(); },
  };
}

export function renderAdminPage() {
  return readFileSync(new URL('./admin-dashboard.html', import.meta.url), 'utf8');
}
