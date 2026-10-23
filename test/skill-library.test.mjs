import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSkillLibrary, RECOMMENDED_SKILLS } from '../scripts/skill-library.mjs';

test('Skill Center discovers favorites, validates paths and keeps all settings local', async () => {
  const root = await mkdtemp(join(tmpdir(), 'umibridge-skill-test-'));
  try {
    const homeDir = join(root, 'fake-home');
    const stateDir = join(root, 'local-state');
    const codexRoot = join(homeDir, '.codex', 'skills');
    await mkdir(join(codexRoot, 'ui-ux-pro-max'), { recursive: true });
    await mkdir(join(codexRoot, 'random-private-skill'), { recursive: true });
    await writeFile(join(codexRoot, 'ui-ux-pro-max', 'SKILL.md'),
      '---\nname: ui-ux-pro-max\ndescription: UI design principles for a test.\n---\n# Test Skill\nFollow instructions.');
    await writeFile(join(codexRoot, 'random-private-skill', 'SKILL.md'),
      '---\ndescription: >\n  A folded description\n  for the selected skill.\nlicense: MIT\n---\n# Unapproved Skill\nThis should not be active automatically.');
    const library = createSkillLibrary({ stateDir, homeDir });
    const discovered = await library.list();
    assert.equal(discovered.length, 2);
    assert.equal(discovered.find(s => s.name === 'ui-ux-pro-max').enabled, true);
    assert.equal(discovered.find(s => s.name === 'random-private-skill').enabled, false);
    assert.equal(discovered.find(s => s.name === 'random-private-skill').description, 'A folded description for the selected skill.');
    assert.equal(discovered.find(s => s.name === 'ui-ux-pro-max').description, 'UI design principles for a test.');
    assert.equal(discovered.some(s => Object.hasOwn(s, '_file') || Object.hasOwn(s, 'path')), false, 'API must not disclose absolute paths.');
    assert.ok(RECOMMENDED_SKILLS.includes('playwright-cli'));
    await assert.rejects(() => library.read('random-private-skill'), /disabled/);
    await library.setEnabled('random-private-skill', true);
    assert.match((await library.read('random-private-skill')).markdown, /Unapproved Skill/);
    await library.setEnabled('ui-ux-pro-max', false);
    await assert.rejects(() => library.read('ui-ux-pro-max'), /disabled/);
    assert.equal((await createSkillLibrary({ stateDir, homeDir }).list()).find(s => s.name === 'ui-ux-pro-max').enabled, false);
    const otherProcess = createSkillLibrary({ stateDir, homeDir });
    await otherProcess.setEnabled('random-private-skill', false);
    assert.equal((await library.list()).find(s => s.name === 'random-private-skill').enabled, false, 'Warm metadata cache observes another process disabling a skill immediately.');
    await assert.rejects(() => library.read('random-private-skill'), /disabled/);
    await otherProcess.setEnabled('random-private-skill', true);
    assert.match((await library.read('random-private-skill')).markdown, /Unapproved Skill/);

    const externalSkill = join(codexRoot, 'externally-installed');
    await mkdir(externalSkill);
    await writeFile(join(externalSkill, 'SKILL.md'), '# External Skill\nInstalled outside Skill Center.');
    assert.ok((await library.list()).some(s => s.name === 'externally-installed'), 'Directory changes invalidate discovery metadata immediately.');
    await writeFile(join(codexRoot, 'random-private-skill', 'SKILL.md'), '---\ndescription: Externally edited metadata.\n---\n# Unapproved Skill\nFRESH_BODY_FROM_DISK');
    assert.match((await library.read('random-private-skill')).markdown, /FRESH_BODY_FROM_DISK/, 'Full skill content is always read fresh even while metadata is warm.');
    await new Promise(done => setTimeout(done, 1100));
    assert.equal((await library.list()).find(s => s.name === 'random-private-skill').description, 'Externally edited metadata.', 'Externally edited summaries refresh within the short metadata lifetime.');
    const cachedRegistry = await readFile(join(stateDir, 'skill-registry.json'), 'utf8');
    await writeFile(join(stateDir, 'skill-registry.json'), '{broken registry');
    await assert.rejects(() => library.list(), /JSON|position|property/i, 'A malformed registry never falls back to a previously enabled cached result.');
    await writeFile(join(stateDir, 'skill-registry.json'), cachedRegistry);

    const custom = join(root, 'custom', 'my-awesome-skill');
    await mkdir(custom, { recursive: true });
    await writeFile(join(custom, 'SKILL.md'), '# My Skill\nOnly personal instructions.');
    assert.deepEqual(await library.add(custom), { name: 'my-awesome-skill', enabled: true });
    assert.equal((await library.list()).find(s => s.name === 'my-awesome-skill').source, 'Added locally');
    assert.match((await library.read('my-awesome-skill')).markdown, /Only personal instructions/);
    await assert.rejects(() => library.add(custom), /already listed/);
    await assert.rejects(() => library.add('relative/skill'), /absolute path/);
    await assert.rejects(() => library.read('../secrets'), /Invalid skill name/);
    await assert.rejects(() => library.remove('ui-ux-pro-max'), /manually added/);
    const removed = await library.remove('my-awesome-skill');
    assert.equal(removed.deletedSource, false);
    await assert.rejects(() => library.read('my-awesome-skill'), /not found/);
    assert.match(await readFile(join(custom, 'SKILL.md'), 'utf8'), /Only personal instructions/);

    const symlinked = join(root, 'symlinked');
    await mkdir(symlinked);
    try {
      await symlink(join(custom, 'SKILL.md'), join(symlinked, 'SKILL.md'), 'file');
      await assert.rejects(() => library.add(symlinked), /regular file/);
    } catch (cause) {
      // Standard Windows accounts may not have SeCreateSymbolicLinkPrivilege.
      if (!['EPERM', 'EACCES', 'ENOTSUP'].includes(cause.code)) throw cause;
    }
    const rawState = await readFile(join(stateDir, 'skill-registry.json'), 'utf8');
    assert.ok(!rawState.includes('Only personal instructions'), 'Registry stores a path reference, never SKILL.md text.');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
