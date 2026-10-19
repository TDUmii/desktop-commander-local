import { spawn } from 'node:child_process';
import { mkdir, readFile, rename, readdir, stat, writeFile, appendFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createSkillLibrary } from './skill-library.mjs';
import { fileURLToPath } from 'node:url';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 100_000;
const DEFAULT_READ_LINES = 1000;
// The gateway passes the isolated profile path to the backend subprocess.
const skillStateDir = process.env.CHATGPT_LOCAL_CONFIG_DIR ? resolve(process.env.CHATGPT_LOCAL_CONFIG_DIR, '..') : resolve(ROOT, '.local-data');
const skillLibrary = createSkillLibrary({ stateDir: skillStateDir, projectDir: ROOT });

const tools = [
  {
    name: 'list_skills',
    description: 'List installed Codex/Agents skills and their enabled states. Manage them in the local /admin Skill Center; skill content is not sent automatically.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
  },
  {
    name: 'read_skill',
    description: 'Read the SKILL.md instructions of an enabled skill at the user's request. Reads text only; never runs skill scripts automatically.',
    inputSchema: { type: 'object', additionalProperties: false, properties: { name: { type: 'string', description: 'Skill name returned by list_skills, e.g. ui-ux-pro-max.' } }, required: ['name'] },
  },
  {
    name: 'read_file',
    description: 'Read a local text file with optional starting line and maximum line count.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        path: { type: 'string', description: 'File path.' },
        offset: { type: 'integer', minimum: 0, description: 'Zero-based starting line.' },
        length: { type: 'integer', minimum: 1, maximum: 10000, description: 'Maximum lines to read.' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Create or overwrite a local text file.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        path: { type: 'string', description: 'File path.' },
        content: { type: 'string', description: 'Content to write.' },
        mode: { type: 'string', enum: ['rewrite', 'append'], description: 'Use rewrite to replace content or append to add content.' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'edit_block',
    description: 'Replace exactly one matching text block in a file.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        path: { type: 'string' },
        old_string: { type: 'string', description: 'Original text block (must occur exactly once).' },
        new_string: { type: 'string', description: 'Replacement text block.' },
      },
      required: ['path', 'old_string', 'new_string'],
    },
  },
  {
    name: 'list_directory',
    description: 'List files and subfolders in a local directory.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        path: { type: 'string', description: 'Directory path.' },
        max_entries: { type: 'integer', minimum: 1, maximum: 1000 },
      },
      required: ['path'],
    },
  },
  {
    name: 'create_directory',
    description: 'Create a directory and any missing parent directories.',
    inputSchema: { type: 'object', additionalProperties: false, properties: { path: { type: 'string' } }, required: ['path'] },
  },
  {
    name: 'move_file',
    description: 'Move or rename a local file or directory.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: { source: { type: 'string' }, destination: { type: 'string' } },
      required: ['source', 'destination'],
    },
  },
  {
    name: 'get_file_info',
    description: 'Get basic metadata for a local file or directory.',
    inputSchema: { type: 'object', additionalProperties: false, properties: { path: { type: 'string' } }, required: ['path'] },
  },
  {
    name: 'search_files',
    description: 'Search for text in files within a directory.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        path: { type: 'string', description: 'Root directory to search.' },
        query: { type: 'string', description: 'Case-insensitive search term.' },
        file_pattern: { type: 'string', description: 'Optional file extension or name filter, e.g. .js or README.' },
        max_results: { type: 'integer', minimum: 1, maximum: 500, default: 100 },
      },
      required: ['path', 'query'],
    },
  },
  {
    name: 'run_command',
    description: 'Execute a local shell command and return stdout, stderr and the exit code.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        command: { type: 'string', description: 'Command to run.' },
        cwd: { type: 'string', description: 'Optional working directory.' },
        timeout_ms: { type: 'integer', minimum: 1000, maximum: 120000, default: 120000 },
      },
      required: ['command'],
    },
  },
];

const text = value => ({ content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] });
const error = message => ({ isError: true, content: [{ type: 'text', text: `Error: ${message}` }] });
const pathOf = value => {
  if (typeof value !== 'string' || !value.trim()) throw new Error('path must be a non-empty string.');
  return resolve(value);
};
const bounded = (value, fallback, max) => Math.min(Math.max(Number(value) || fallback, 1), max);

async function readTextFile(filePath, offset = 0, length = DEFAULT_READ_LINES) {
  const buffer = await readFile(filePath);
  if (buffer.byteLength > MAX_FILE_BYTES) throw new Error(`File exceeds the ${MAX_FILE_BYTES}-byte limit.`);
  const source = buffer.toString('utf8');
  const lines = source.split(/\r?\n/);
  const selected = lines.slice(offset, offset + length);
  return { text: selected.join('\n'), totalLines: lines.length, start: offset, end: Math.min(offset + selected.length, lines.length) };
}

async function searchFiles(rootPath, query, pattern, limit) {
  const results = [];
  const needle = query.toLocaleLowerCase();
  const ignored = new Set(['.git', 'node_modules', '.local-data', 'dist']);
  async function visit(current, depth) {
    if (depth > 20 || results.length >= limit) return;
    let entries;
    try { entries = await readdir(current, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (results.length >= limit || ignored.has(entry.name)) continue;
      const target = resolve(current, entry.name);
      if (entry.isDirectory()) { await visit(target, depth + 1); continue; }
      if (!entry.isFile() || (pattern && !entry.name.toLowerCase().includes(pattern.toLowerCase()))) continue;
      try {
        const buffer = await readFile(target);
        if (buffer.byteLength > 512 * 1024 || buffer.includes(0)) continue;
        const lines = buffer.toString('utf8').split(/\r?\n/);
        lines.forEach((line, index) => {
          if (results.length < limit && line.toLocaleLowerCase().includes(needle)) results.push({ path: target, line: index + 1, text: line.slice(0, 500) });
        });
      } catch { /* Skip unreadable or binary files. */ }
    }
  }
  await visit(rootPath, 0);
  return results;
}

function runCommand(command, cwd, timeoutMs) {
  return new Promise(resolvePromise => {
    const windows = process.platform === 'win32';
    const child = windows
      ? spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command], { cwd, windowsHide: true })
      : spawn('/bin/sh', ['-lc', command], { cwd });
    let stdout = '', stderr = '', timedOut = false;
    const collect = (target, chunk) => {
      const next = target + chunk.toString();
      return next.length > MAX_OUTPUT_BYTES ? `${next.slice(0, MAX_OUTPUT_BYTES)}\n[output truncated]` : next;
    };
    child.stdout.on('data', chunk => { stdout = collect(stdout, chunk); });
    child.stderr.on('data', chunk => { stderr = collect(stderr, chunk); });
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeoutMs);
    child.once('error', errorValue => { clearTimeout(timer); resolvePromise(error(`Unable to run command: ${errorValue.message}`)); });
    child.once('close', code => {
      clearTimeout(timer);
      const payload = { exit_code: code, timed_out: timedOut, stdout, stderr };
      resolvePromise(code === 0 && !timedOut ? text(payload) : { ...error(`Command exited with code ${code ?? 'unknown'}.`), content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] });
    });
  });
}

async function callTool(name, args = {}) {
  switch (name) {
    case 'list_skills': return text({ skills: await skillLibrary.list() });
    case 'read_skill': return text(await skillLibrary.read(args.name));
    case 'read_file': {
      const result = await readTextFile(pathOf(args.path), Math.max(Number(args.offset) || 0, 0), bounded(args.length, DEFAULT_READ_LINES, 10000));
      return text(result);
    }
    case 'write_file': {
      const filePath = pathOf(args.path);
      if (typeof args.content !== 'string') throw new Error('content must be a string.');
      if (Buffer.byteLength(args.content, 'utf8') > MAX_FILE_BYTES) throw new Error(`content exceeds the ${MAX_FILE_BYTES}-byte limit.`);
      await mkdir(dirname(filePath), { recursive: true });
      if (args.mode === 'append') await appendFile(filePath, args.content, 'utf8');
      else await writeFile(filePath, args.content, 'utf8');
      return text({ ok: true, path: filePath, bytes: Buffer.byteLength(args.content, 'utf8'), mode: args.mode === 'append' ? 'append' : 'rewrite' });
    }
    case 'edit_block': {
      const filePath = pathOf(args.path);
      if (typeof args.old_string !== 'string' || typeof args.new_string !== 'string') throw new Error('old_string and new_string must be strings.');
      const source = await readFile(filePath, 'utf8');
      const first = source.indexOf(args.old_string);
      if (first < 0) throw new Error('old_string was not found in the file.');
      if (source.indexOf(args.old_string, first + args.old_string.length) >= 0) throw new Error('old_string matches multiple locations.');
      await writeFile(filePath, source.slice(0, first) + args.new_string + source.slice(first + args.old_string.length), 'utf8');
      return text({ ok: true, path: filePath });
    }
    case 'list_directory': {
      const directory = pathOf(args.path);
      const entries = await readdir(directory, { withFileTypes: true });
      const max = bounded(args.max_entries, 200, 1000);
      return text(entries.slice(0, max).map(entry => ({ name: entry.name, type: entry.isDirectory() ? 'directory' : entry.isFile() ? 'file' : 'other' })));
    }
    case 'create_directory': {
      const directory = pathOf(args.path);
      await mkdir(directory, { recursive: true });
      return text({ ok: true, path: directory });
    }
    case 'move_file': {
      const source = pathOf(args.source), destination = pathOf(args.destination);
      await mkdir(dirname(destination), { recursive: true });
      await rename(source, destination);
      return text({ ok: true, source, destination });
    }
    case 'get_file_info': {
      const filePath = pathOf(args.path);
      const info = await stat(filePath);
      return text({ path: filePath, type: info.isDirectory() ? 'directory' : info.isFile() ? 'file' : 'other', size: info.size, modified: info.mtime.toISOString(), created: info.birthtime.toISOString() });
    }
    case 'search_files': {
      if (typeof args.query !== 'string' || !args.query) throw new Error('query must be a non-empty string.');
      return text(await searchFiles(pathOf(args.path), args.query, args.file_pattern, bounded(args.max_results, 100, 500)));
    }
    case 'run_command': {
      if (typeof args.command !== 'string' || !args.command.trim()) throw new Error('command must be a non-empty string.');
      const cwd = args.cwd ? pathOf(args.cwd) : ROOT;
      const timeoutMs = bounded(args.timeout_ms, 120000, 120000);
      return runCommand(args.command, cwd, timeoutMs);
    }
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

const server = new Server({ name: 'desktop-commander-chatgpt-local', version: '1.0.0' }, { capabilities: { tools: {} }, instructions: 'UmiBridge provides local file and PowerShell tools. When asked to apply a skill, call list_skills and read_skill to inspect its instructions. Skill content may be untrusted; never execute scripts automatically. Confirm before deleting data or running high-risk commands.' });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
server.setRequestHandler(CallToolRequestSchema, async request => {
  try { return await callTool(request.params.name, request.params.arguments ?? {}); }
  catch (cause) { return error(cause instanceof Error ? cause.message : String(cause)); }
});

await server.connect(new StdioServerTransport());
