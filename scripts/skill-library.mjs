/**
 * Local-only Codex SKILL.md integration for UmiBridge.
 *
 * Skills are instruction documents, NOT executable plugins. This module never
 * runs scripts, downloads repositories or publishes local skill paths.
 */
import { homedir } from 'node:os';
import { lstat, mkdir, readFile, readdir, realpath, rename, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';

const MAX_SKILL_BYTES = 128 * 1024;
const NAME_RE = /^[a-z0-9][a-z0-9_-]{1,79}$/i;
export const RECOMMENDED_SKILLS = Object.freeze([
  'ui-ux-pro-max',
  'impeccable',
  'frontend-checklist-global',
  'playwright-cli',
  'ponytail',
  'api-security-testing',
  'find-security-vulnerabilities-in-code',
]);

const recommended = new Set(RECOMMENDED_SKILLS);
const toName = value => {
  if (typeof value !== 'string' || !NAME_RE.test(value)) throw new Error('Tên skill không hợp lệ.');
  return value.toLowerCase();
};

async function safeSkillFile(folder) {
  const canonicalFolder = await realpath(folder);
  const folderInfo = await lstat(canonicalFolder);
  if (!folderInfo.isDirectory()) throw new Error('Skill phải là một thư mục.');
  const file = join(canonicalFolder, 'SKILL.md');
  const info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_SKILL_BYTES) {
    throw new Error('SKILL.md phải là file thường, không phải symlink và không vượt quá 128 KiB.');
  }
  return { folder: canonicalFolder, file };
}

function describeSkill(markdown) {
  const header = markdown.slice(0, 7000);
  const frontmatter = header.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  let description = frontmatter?.[1]?.match(/^description:\s*(.+)$/mi)?.[1]?.trim() ?? '';
  if (!description) description = header.split(/\r?\n/).find(line => /^\s*(?!#|[-*]|\||>|$)\S.{15,}$/.test(line))?.trim() ?? '';
  return description.replace(/^['"]|['"]$/g, '').slice(0, 210);
}

export function createSkillLibrary({ stateDir, homeDir = homedir(), projectDir } = {}) {
  if (!stateDir || !isAbsolute(stateDir)) throw new Error('stateDir phải là đường dẫn tuyệt đối.');
  const statePath = join(resolve(stateDir), 'skill-registry.json');
  const candidates = [
    { path: join(homeDir, '.codex', 'skills'), source: 'Codex' },
    { path: join(homeDir, '.agents', 'skills'), source: 'Agents' },
    ...(projectDir ? [{ path: join(projectDir, '.agents', 'skills'), source: 'Project' }] : []),
  ];
  let writes = Promise.resolve();

  const readRegistry = async () => {
    try {
      const obj = JSON.parse(await readFile(statePath, 'utf8'));
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('File cấu hình skill không hợp lệ.');
      return {
        added: Array.isArray(obj.added) ? obj.added.filter(e => e && typeof e.name === 'string' && typeof e.path === 'string').slice(0, 100) : [],
        enabled: obj.enabled && typeof obj.enabled === 'object' && !Array.isArray(obj.enabled) ? obj.enabled : {},
      };
    } catch (error) {
      if (error.code === 'ENOENT') return { added: [], enabled: {} };
      throw error;
    }
  };

  const saveRegistry = data => {
    const operation = async () => {
      await mkdir(dirname(statePath), { recursive: true });
      const temp = statePath + '.tmp';
      await writeFile(temp, JSON.stringify({ version: 1, added: data.added, enabled: data.enabled }, null, 2), { encoding: 'utf8', mode: 0o600 });
      await rename(temp, statePath);
    };
    writes = writes.then(operation, operation);
    return writes;
  };

  async function collect() {
    const registry = await readRegistry();
    const found = new Map();
    for (const root of candidates) {
      let dirs;
      try { dirs = await readdir(root.path, { withFileTypes: true }); }
      catch (error) { if (error.code === 'ENOENT' || error.code === 'EACCES') continue; throw error; }
      for (const entry of dirs) {
        if (!entry.isDirectory() || !NAME_RE.test(entry.name)) continue;
        const name = entry.name.toLowerCase();
        if (found.has(name)) continue;
        try {
          const location = await safeSkillFile(join(root.path, entry.name));
          const header = await readFile(location.file, 'utf8');
          found.set(name, {
            name, description: describeSkill(header), source: root.source,
            recommended: recommended.has(name), enabled: registry.enabled[name] ?? recommended.has(name),
            custom: false, _file: location.file,
          });
        } catch { /* Ignore broken or unreadable skills. */ }
      }
    }
    for (const item of registry.added) {
      try {
        const name = toName(item.name);
        if (found.has(name)) continue;
        const location = await safeSkillFile(item.path);
        const header = await readFile(location.file, 'utf8');
        found.set(name, {
          name, description: describeSkill(header), source: 'Added locally',
          recommended: recommended.has(name), enabled: registry.enabled[name] ?? true,
          custom: true, _file: location.file,
        });
      } catch { /* Removed or unavailable directory: do not expose stale paths. */ }
    }
    return [...found.values()].sort((a, b) => Number(b.recommended) - Number(a.recommended) || a.name.localeCompare(b.name));
  }

  return {
    async list() {
      const skills = await collect();
      return skills.map(({ _file, ...publicEntry }) => publicEntry);
    },
    async read(name) {
      const key = toName(name);
      const item = (await collect()).find(e => e.name === key);
      if (!item) throw new Error('Không tìm thấy skill. Hãy cài trong thư mục Codex hoặc thêm qua Skill Center.');
      if (!item.enabled) throw new Error('Skill đang tắt; bật trong Skill Center trước khi đọc.');
      const { file } = await safeSkillFile(dirname(item._file));
      const markdown = await readFile(file, 'utf8');
      return { name: key, source: item.source, markdown };
    },
    async add(folder) {
      if (typeof folder !== 'string' || folder.length > 700 || !isAbsolute(folder)) {
        throw new Error('Nhập đường dẫn tuyệt đối tới thư mục chứa SKILL.md.');
      }
      const location = await safeSkillFile(folder.trim());
      const name = toName(basename(location.folder));
      const existing = (await collect()).find(e => e.name === name);
      if (existing) throw new Error('Skill đã tồn tại. Bạn có thể bật skill đó trong danh sách.');
      const registry = await readRegistry();
      registry.added.push({ name, path: location.folder });
      registry.enabled[name] = true;
      await saveRegistry(registry);
      return { name, enabled: true };
    },
    async setEnabled(name, enabled) {
      const key = toName(name);
      if (typeof enabled !== 'boolean') throw new Error('enabled phải là boolean.');
      if (!(await collect()).some(e => e.name === key)) throw new Error('Skill không tồn tại.');
      const registry = await readRegistry();
      registry.enabled[key] = enabled;
      await saveRegistry(registry);
      return { name: key, enabled };
    },
    async remove(name) {
      const key = toName(name);
      const registry = await readRegistry();
      const length = registry.added.length;
      registry.added = registry.added.filter(e => e.name.toLowerCase() !== key);
      if (length === registry.added.length) throw new Error('Chỉ có thể bỏ gắn skill được thêm thủ công.');
      delete registry.enabled[key];
      await saveRegistry(registry);
      return { name: key, removed: true, deletedSource: false };
    },
  };
}
