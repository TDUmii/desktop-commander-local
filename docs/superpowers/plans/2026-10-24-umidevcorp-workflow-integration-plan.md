# UmiDevCorp Workflow Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a feature-flagged, manual-only workflow ledger and dashboard view to UmiBridge using the useful project/task/handoff management concepts from UmiDevCorp.

**Architecture:** Keep UmiBridge's Node gateway, request history, device registry, privilege control, and hidden worker unchanged as execution layers. Add a small JSONL workflow ledger above them, with explicit status transitions, idempotent job linking, restart recovery, and filtered local-admin API routes. Add a Workflows dashboard section that reads this API and never dispatches automatically.

**Tech Stack:** Node.js ESM, Express 5, JSONL in `.local-data`, Node built-in test runner, existing single-file HTML dashboard.

**Spec:** `docs/superpowers/specs/2026-10-24-umidevcorp-workflow-integration-design.md`

## Global Constraints

- `UMIBRIDGE_WORKFLOWS=0` is the default and no automation or heartbeat is created.
- Workflow state stays in `.local-data`; never read or copy `UmiDevCorp/devcorp.db`, cookies, browser state, runtime, screenshots, or logs.
- Existing MCP job status, request history, OAuth, tunnel, tool policy, skill registry, and Normal/Administrator lifecycle remain compatible.
- Workflow writes require the existing local-admin and `x-dc-admin-action` guards; no Windows Administrator elevation is needed.
- Source ZIP/Git must contain source only and no private/runtime state.

## Review Focus

- Duplicate manual linking after a gateway restart - test the same `dispatch_key` returns the existing workflow/job link.
- A partial JSONL line or truncated event - test startup ignores only the incomplete tail and preserves valid records.
- A stale `version` or invalid transition - test the API returns a conflict without mutating the record.
- A workflow pointing at a pruned job or request - test it remains visible with a bounded missing-link reason.
- Feature flag off - test the dashboard hides Workflows and the API does not create state.

### Task 1: Workflow ledger and contract tests

**Files:**
- Create: `scripts/workflow-ledger.mjs`
- Test: `test/workflow-ledger.test.mjs`

**Interfaces:**
- Produces `createWorkflowLedger(filePath, options)` with `list`, `get`, `create`, `update`, `linkJob`, `appendEvent`, `recover`, `exportData`, and `importData`.
- A workflow record contains `workflow_id`, `project_key`, `chat_key`, `title`, `role`, `status`, `request_ids`, `job_id`, `parent_id`, `next_role`, `next_task`, `hop`, `baseline_hash`, `version`, timestamps, and bounded `blocked_reason`.

- [ ] Write failing tests for creation, allowed transitions including `paused`, invalid transitions, optimistic version conflicts, idempotent `linkJob`, restart recovery of `running` records to `waiting`, partial-line recovery, and redacted import/export.
- [ ] Run `node --test test/workflow-ledger.test.mjs` and observe the expected missing-module failure.
- [ ] Implement JSONL append/read with one serialized write queue, schema validation, bounded fields, deterministic `dispatch_key`, event sequence numbers, and safe tail recovery.
- [ ] Run the focused test and verify all ledger behaviors pass.
- [ ] Refactor only after green; keep the public API small and side-effect free when the feature is disabled.

### Task 2: Local-admin API integration

**Files:**
- Modify: `scripts/local-web-gateway.mjs`
- Modify: `scripts/local-admin.mjs` only if a shared redaction helper is needed
- Test: `test/workflow-gateway.test.mjs`

**Interfaces:**
- `startGateway` accepts optional `workflowEnabled`; default is `process.env.UMIBRIDGE_WORKFLOWS === '1'`.
- Routes: `GET /admin/api/workflows`, `POST /admin/api/workflows`, `GET /admin/api/workflows/:id`, `PATCH /admin/api/workflows/:id`, `POST /admin/api/workflows/:id/link-job`, `GET /admin/api/workflows/:id/events`, `POST /admin/api/workflows/export`, and `POST /admin/api/workflows/import`.

- [ ] Add failing API tests for flag-off behavior, read access, action-guarded writes, manual creation from request IDs, valid/invalid transitions, idempotent job linking, restart recovery, and import/export redaction.
- [ ] Run the focused gateway test and observe the expected missing routes/factory failure.
- [ ] Instantiate the ledger beside existing `.local-data` stores and recover it once per gateway start; do not auto-create a workflow from each MCP tool call.
- [ ] Add bounded JSON bodies, `ETag`/version conflict responses, project/chat key validation, and safe missing request/job metadata.
- [ ] Run the focused gateway test and the existing `test/local-gateway.test.mjs`.

### Task 3: Workflows dashboard view

**Files:**
- Modify: `scripts/admin-dashboard.html`
- Test: `test/workflow-ui.test.mjs`

**Interfaces:**
- Dashboard model adds `workflowState` and view hash `workflows`.
- UI calls only the API from Task 2; it must not call MCP or dispatch a job automatically.

- [ ] Add failing static/UI tests for the navigation item, feature-flag empty state, workflow table, status badge, project/chat/job links, blocked reason, and manual action buttons.
- [ ] Run the focused UI test and observe missing markup/handlers.
- [ ] Add a responsive Workflows section with compact filters, create form, status transitions, pause/resume, link-job action, empty/error states, and a timeline drawer.
- [ ] Load workflow data as a separate request so an open request detail remains stable; keep auto-refresh off unless the existing user preference is explicitly on.
- [ ] Run the focused UI test and existing setup/i18n/privilege UI tests.

### Task 4: Documentation, release validation, and publication

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `RELEASE_NOTES.md`
- Modify: `docs/superpowers/specs/2026-10-24-umidevcorp-workflow-integration-design.md`

- [ ] Add the workflow ledger to the build syntax checks and document the feature flag, manual-only behavior, status model, export privacy, and rollback.
- [ ] Bump the release version to the next beta only after the complete test suite is green.
- [ ] Run `npm run build`, `npm run local:test`, `git diff --check`, source/privacy scan, and ZIP inspection.
- [ ] Inspect the local dashboard at `/admin#workflows` and verify flag-off behavior, then enable the feature only for the QA process and verify create/update/link/restart recovery.
- [ ] Commit scoped source/docs/tests, push `main`, run CI, create/update the Latest source ZIP release, verify SHA-256/digest parity, and preserve older releases.
