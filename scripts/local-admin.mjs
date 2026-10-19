import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname } from 'node:path';

const MAX_ENTRIES = 500;
const MAX_TEXT = 500;
const sensitiveKey = /^(content|data|input|password|secret|token|authorization|cookie)$/i;
const home = homedir().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const homePattern = home ? new RegExp(home, 'ig') : null;

function safeString(value) {
  const text = String(value).replace(homePattern ?? /$^/, '~');
  return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}…` : text;
}

function safeArguments(value, key, depth = 0) {
  if (key && sensitiveKey.test(key)) return '[redacted for privacy]';
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return safeString(value);
  if (depth >= 3) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 20).map(item => safeArguments(item, key, depth + 1));
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).slice(0, 30).map(([name, item]) => [name, safeArguments(item, name, depth + 1)]));
  }
  return String(value);
}

function recordFor(toolName, args, result, duration) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    toolName: safeString(toolName),
    arguments: safeArguments(args),
    status: result?.isError ? 'error' : 'ok',
    contentItems: Array.isArray(result?.content) ? result.content.length : 0,
    durationMs: Math.max(0, Math.round(duration)),
  };
}

export async function createRequestHistory(filePath) {
  await mkdir(dirname(filePath), { recursive: true });
  let entries = [];
  try {
    const lines = (await readFile(filePath, 'utf8')).split(/\r?\n/).filter(Boolean);
    entries = lines.slice(-MAX_ENTRIES).flatMap(line => {
      try {
        const item = JSON.parse(line);
        return item?.id && item?.timestamp && item?.toolName ? [item] : [];
      } catch {
        return [];
      }
    });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  let writes = Promise.resolve();
  const enqueue = task => {
    writes = writes.then(task, task);
    return writes;
  };
  return {
    add(toolName, args, result, duration) {
      const entry = recordFor(toolName, args, result, duration);
      entries = [...entries, entry].slice(-MAX_ENTRIES);
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
        const current = toolCounts.get(name) ?? { name, count: 0, errors: 0, totalDuration: 0 };
        current.count++;
        current.errors += entry.status === 'ok' ? 0 : 1;
        current.totalDuration += entry.durationMs;
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
      return { total: entries.length, tools: tools.size, latest: entries.at(-1)?.timestamp ?? null,
        success, errors, averageMs, p95Ms, recent24h, toolBreakdown, hourly };
    },
    clear() {
      entries = [];
      return enqueue(() => writeFile(filePath, '', 'utf8'));
    },
  };
}


/** Optional, user-entered ChatGPT conversation links. The MCP protocol does not expose chat IDs. */
export function parseChatLink(raw) {
  if (typeof raw !== 'string' || raw.length > 500) throw new Error('Provide a valid ChatGPT conversation URL.');
  let url;
  try { url = new URL(raw.trim()); } catch { throw new Error('Use a full ChatGPT HTTPS URL.'); }
  if (url.protocol !== 'https:' ||
      !['chatgpt.com', 'chat.openai.com'].includes(url.hostname) ||
      url.username || url.password || url.port || url.search || url.hash) {
    throw new Error('Only HTTPS links from chatgpt.com or chat.openai.com are accepted, without query parameters.');
  }
  const match = url.pathname.match(/^\/(?:g\/[a-zA-Z0-9_-]+\/)?(?:c|share)\/([a-zA-Z0-9_-]{6,100})\/?$/);
  if (!match) throw new Error('The URL must point to a conversation (/c/...) or shared chat (/share/...).');
  return { chatId: match[1], chatUrl: url.origin + url.pathname.replace(/\/$/, ''), kind: url.pathname.includes('/share/') ? 'shared' : 'conversation' };
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
