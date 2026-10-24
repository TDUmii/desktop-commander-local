import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const dashboard = await readFile(new URL('../scripts/admin-dashboard.html', import.meta.url), 'utf8');

test('dashboard exposes a feature-flagged Workflows view with manual controls', () => {
  assert.match(dashboard, /data-view="workflows"/);
  assert.match(dashboard, /href="#workflows"/);
  assert.match(dashboard, /id="workflows"/);
  assert.match(dashboard, /id="workflowState"/);
  assert.match(dashboard, /admin\/api\/workflows/);
  assert.match(dashboard, /link-job/);
  assert.match(dashboard, /paused/);
  assert.match(dashboard, /blocked_reason/);
  assert.match(dashboard, /workflowEnabled/);
  assert.match(dashboard, /id="workflowChatKey"[^>]*required/);
});

test('workflow view renders status, project/chat/job links, and does not auto-dispatch MCP jobs', () => {
  assert.match(dashboard, /workflow-status/);
  assert.match(dashboard, /data-workflow-action/);
  assert.match(dashboard, /dispatchKey/);
  assert.match(dashboard, /timeline/);
  assert.match(dashboard, /data-workflow-link="request"/);
  assert.match(dashboard, /#requests/);
  assert.match(dashboard, /data-workflow-link="activity"/);
  assert.doesNotMatch(dashboard, /\/mcp['"]\s*,\s*\{method:\s*['"]POST/);
});

test('workflow timeline renders ledger event types and status payloads', () => {
  assert.match(dashboard, /event\.type\|\|event\.kind/);
  assert.match(dashboard, /event\.payload\?\.status/);
});
