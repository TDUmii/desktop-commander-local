# UmiDevCorp Workflow Integration Implementation Plan

> Delivery checklist, updated 2026-10-24. Checked items describe verified beta.22 behavior and acceptance, not a claim that historical red-test commands were repeated during closeout.

**Goal:** Add a feature-flagged, manual-only workflow ledger and dashboard view to UmiBridge using the useful project/task/handoff management concepts from UmiDevCorp.

**Architecture:** Keep UmiBridge's Node gateway, request history, device registry, privilege control, and hidden worker unchanged as execution layers. Add a small JSONL workflow ledger above them, with explicit status transitions, idempotent job linking, restart recovery, and filtered local-admin API routes. Add a Workflows dashboard section that reads this API and never dispatches automatically.

**Tech Stack:** Node.js ESM, Express 5, JSONL in `.local-data`, Node built-in test runner, existing single-file HTML dashboard.

**Spec:** `docs/superpowers/specs/2026-10-24-umidevcorp-workflow-integration-design.md`

**Delivered:** `v0.1.0-beta.22`, runtime commit `a2f08ea859c94f10b78d654bd311caef62679985`. Build, 84 released-artifact regression tests, Chrome job linking, native Admin and release hash parity passed. Current closeout evidence is recorded in `docs/ACCEPTANCE.vi.md`; diagnostics stay in ignored `.local-data/qa`.

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

- [x] Contract tests cover creation, `paused`, invalid transitions, version conflicts, idempotent linking, restart recovery, partial-line recovery and redacted import/export.
- [x] The focused ledger tests pass; initial missing-module red was recorded before the original implementation.
- [x] JSONL append/read uses serialized writes, file locking, bounded schema fields, opaque/fallback-hashed link keys, event sequence numbers and safe tail recovery. Imports share the write queue.
- [x] Focused and full released-artifact regression runs pass.
- [x] Disabled mode stays side-effect free; public ledger API remains within the existing factory.

### Task 2: Local-admin API integration

**Files:**
- Modify: `scripts/local-web-gateway.mjs`
- Modify: `scripts/local-admin.mjs` only if a shared redaction helper is needed
- Test: `test/workflow-gateway.test.mjs`

**Interfaces:**
- `startGateway` accepts optional `workflowEnabled`; otherwise opt in through `UMIBRIDGE_WORKFLOWS=1` or the profile-local `workflows-enabled` marker. Explicit `false` takes precedence.
- Routes: `GET /admin/api/workflows`, `POST /admin/api/workflows`, `GET /admin/api/workflows/:id`, `PATCH /admin/api/workflows/:id`, `POST /admin/api/workflows/:id/link-job`, `GET /admin/api/workflows/:id/events`, `POST /admin/api/workflows/export`, and `POST /admin/api/workflows/import`.

- [x] API tests cover flag-off behavior, read access, guarded writes, request references, transitions, idempotent linking and filtered export; ledger tests cover restart/import recovery and redaction.
- [x] Focused gateway tests pass, including independent opt-in profiles and explicit disable precedence.
- [x] Ledger opens beside existing `.local-data` stores and recovers once per gateway start; MCP calls do not auto-create workflows.
- [x] API bounds JSON bodies, provides ETag/version conflicts, validates opaque project/chat keys and reports missing links safely.
- [x] Workflow gateway and existing local gateway regression tests pass in the released-artifact suite.

### Task 3: Workflows dashboard view

**Files:**
- Modify: `scripts/admin-dashboard.html`
- Test: `test/workflow-ui.test.mjs`

**Interfaces:**
- Dashboard model adds `workflowState` and view hash `workflows`.
- UI calls only the API from Task 2; it must not call MCP or dispatch a job automatically.

- [x] Static/UI tests cover navigation, feature-flag handling, table/status fields, references, blocked reason and manual controls.
- [x] Focused UI tests pass; actual Chrome checks exercise the inline link-job form and stale-tab conflict.
- [x] Workflows includes filters, creation, status changes, pause/resume, inline job linking, empty/error states and timeline detail. It never dispatches commands.
- [x] Workflow data loads separately; open request details and the existing refresh preference remain intact.
- [x] Workflow UI, setup, localization and privilege UI tests pass in the released-artifact suite.

### Task 4: Documentation, release validation, and publication

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `RELEASE_NOTES.md`
- Modify: `docs/superpowers/specs/2026-10-24-umidevcorp-workflow-integration-design.md`

- [x] Build syntax checks include the ledger; README and release notes describe opt-in, manual behavior, statuses, export privacy and rollback.
- [x] Release version is beta.22; the final artifact passed the full suite before publication.
- [x] Build, full tests, diff check, source/privacy scan and ZIP inspection passed for runtime commit `a2f08ea`.
- [x] Flag-off behavior is covered by real gateway tests; Chrome/native acceptance covers create/update/link/restart recovery and profile/journal preservation.
- [x] Runtime source is committed/pushed; Windows CI passed; beta.22 is Latest with verified ZIP SHA-256. Older releases are preserved.

### Post-release closeout

- [x] Actual ChatGPT web connector reaches the running beta.22 Administrator gateway and displays `ELEVATED=True`, exit code 0 and no timeout. Preserve the separate initial web-render failure in private QA evidence.
- [x] Add simultaneous API-writer regression coverage: one HTTP 200, one HTTP 409, one update event and no command dispatch.
- [x] Submit commands to two local Agents concurrently, verify distinct job IDs and unmixed results; run two independent CLI/PowerShell workers on the same machine.
- [x] Update the spec, delivery checklist and ignored checkpoint to current beta.22 semantics.
- [x] Final closeout build and all 85 regression tests pass with no skips; scoped documentation/tests are published on `main` with Windows CI confirmation and release-note acceptance linkage.

Separate physical-machine acceptance is excluded by the user's choice to use this machine only. Project/chat grouping does not provide per-person authorization for a shared identity. No heartbeat or automatic retry is created.
