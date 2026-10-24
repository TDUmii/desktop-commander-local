# UmiBridge Sakura Console - beta.21

## Remembered Windows privilege mode

Settings separates the gateway's actual privileges from its saved startup mode. Normal privileges remain the default. Switching to Administrator invokes native Windows authorization; the dashboard accepts only the requested mode and never accepts credentials. An authorized protected installation and on-demand interactive scheduled task preserve the selected mode for subsequent launches through the existing `UmiBridge.cmd`. Disabling that mode returns through native authorization and migrates private state with the original medium token.

The protected copy uses administrator/SYSTEM ownership, read/execute access for the original account, owner-rights restrictions for newly created state, a same-account task principal, protected runtime paths and a cleaned worker environment. Source updates are not executed automatically by the elevated task. URL, OAuth, tool/skill choices and request history are retained. Privilege changes are local-only, guarded against CSRF, limited to a mode enum and serialized by the native lifecycle; pending and reconnect states preserve the open dashboard view.

The Windows task uses an internal protected GUI host to start the hidden worker. Native requests from the dashboard leave the gateway process tree through Explorer before requesting authorization, so a gateway restart cannot terminate its own mode transition. Native PowerShell execution is regression tested against a successful exit that previously skipped the requested script under `DETACHED_PROCESS`. The runtime validator recognizes only the exact Administrators-only descriptor of an empty native compiler directory directly under protected TEMP; ordinary code and state ACL checks remain strict.

Validation: syntax build and all 62 Windows regression checks passed. Native testing verified a real same-account highest-privilege task, ordinary-token modification denials, elevated command stdout/stderr/exit code, restart with the exact compiler-directory fixture, authorized disable and medium-token restoration. Live dashboard buttons completed both mode changes, and the real ChatGPT connector reconnected with Administrator privileges. Saved URL, connection secret and tool/skill/project selections were retained. Browser checks covered actual privilege states and the existing desktop/mobile, English/Vietnamese, light/dark controls. The test machine's existing UAC policy authorizes RunAs automatically; no password prompt was displayed or policy changed. Cancellation is covered by controlled regression tests.

## Previous beta.20

## Tools, commands and skill access

The Tools page manages named MCP tools with search, groups and individual switches. The server filters disabled tools and rejects stale calls, including the matching linked-device operation, while retaining existing OAuth grants and the saved tunnel. Choices are persisted in private local state.

Automatic MCP guidance describes the enabled tools and skills during connection and refreshes the context after selection changes. Later results carry a compact skill reminder so fresh chats sharing an OAuth client still receive the selection. The dashboard previews the full guidance. Enabled skills are used when relevant and read before applying; their scripts are never executed automatically. This is MCP context rather than an override of ChatGPT system instructions or approval rules. PowerShell access remains broad operating-system access, not a filesystem sandbox.

The Skills page adds clear design-skill labels, search and accessible controls within the existing English/Vietnamese, light/dark dashboard. Existing request details and automatic background refresh remain available.

Validation: all 33 local regression checks passed. The 525-call regression completed in approximately 25 seconds with its original 60-second limit; skill discovery metadata is cached while registry permissions are still reread on every call. Live OAuth/PKCE verified disabled cached-call rejection, matching device restrictions, selection/context updates, automatic-context off, real file contents, hidden PowerShell stdout/stderr/exit code and dashboard history. Browser checks covered 12 interactions and eight desktop/mobile, light/dark captures with no horizontal overflow or page errors. The scoped Tools/Skills visual review resolved its listed findings and scored 9.5/10; this is not a whole-product accessibility certification.

## Previous beta.19

## Windows desktop tools

Adds 20 Windows-MCP desktop tools under `windows_` names: screenshots, UI/DOM snapshots, display inventory, applications/windows, mouse and keyboard, clipboard, process and registry operations, notifications, multi-edit/select, filesystem, web content and wait conditions. Existing `run_command` remains the reusable hidden PowerShell implementation. `windows_status` reports runtime readiness; Settings can pause new desktop calls without disabling files or PowerShell.

The single `UmiBridge.cmd` launcher installs and repairs private Python 3.14.7, verified uv 0.13.5 and hash-locked dependencies. Runtime execution uses reviewed CursorTouch/Windows-MCP revision `e28abb5c6934cb3427190bdb970e02644c915ae3` from a SHA-256-verified source archive. No second endpoint, tunnel, global install or scheduled task is created. Telemetry is disabled and the upstream desktop takeover control remains enabled.

`windows_on_device` routes desktop operations to a linked Agent that advertises support. Mixed image/text results are preserved; remote results are bounded to 2 MiB and the latest eight stay in memory. Device history stores only a summary, never screenshots, clipboard content or typed text. Desktop jobs are not replayed after a Hub restart. This release includes loopback Agent/protocol checks; it does not claim a new two-physical-PC desktop deployment.

Validation: all 31 local regression checks passed. The installed Windows worker exposed all 20 schemas and completed live display, snapshot, screenshot, process, registry and disposable file operations. OAuth HTTP exposed 45 tools, returned a real cropped PNG, rejected a dashboard write without its CSRF header, blocked desktop calls while paused and resumed them afterward. No screenshot base64 entered the request journal. Mouse/keyboard/app operations are exposed from the pinned worker; the live smoke check did not exercise every input operation on the user's desktop.

## Previous beta.18

## ChatGPT-only gateway

This release removes the retired browser-provider integration from the runtime, source tree, launcher, dashboard, documentation and release archive. The private paired route, its CORS policy, setup helper and local credential files are gone. The public MCP surface is now the OAuth-protected `/mcp` endpoint used by ChatGPT.

The one-click launcher, persistent Dev Tunnel, saved OAuth grants, hidden PowerShell worker, request history, token-reference analytics, Skill Center and multi-device Hub/Agent flow remain available. Existing ChatGPT connection details continue to be reused after restart.

The local dashboard and documentation now describe one clear ChatGPT workflow. Startup removes the retired credential files when upgrading an existing installation. The current source ZIP excludes credentials, URLs, account identity, logs, browser data and runtime state.

Validation: syntax build and all 23 Windows regression checks passed, including OAuth persistence, 525 consecutive MCP calls, hidden command execution, two outbound Agents and dashboard localization. The local dashboard responds successfully and the removed endpoint returns 404. The tracked-source privacy scan found no saved credentials or runtime values.

## Previous stable improvements

- Expired Dev Tunnels authentication is refreshed once during setup while retaining the same tunnel ID and public URL.
- Incoming PowerShell commands run through a persistent hidden worker and return bounded stdout, stderr, exit code and timeout state without opening a new console window per request.
- Request counters continue beyond the latest-500 analytics window and restore from the append-only local journal.
- Token estimates use the pinned offline `o200k_base` tokenizer on observed tool payloads and remain clearly separated from model billing.
- Project groups associate requests with a ChatGPT conversation by application and folder boundary.
- The Devices page supports outbound Windows agents with durable job IDs, status, file tools and command results.
- The responsive English/Vietnamese dashboard preserves open request details during refresh and stores only interface preferences in browser local storage.

## Installation and update

Download the source ZIP, extract it to a dedicated folder and open `UmiBridge.cmd`. Existing users may replace tracked source files while preserving ignored `.local-data`; the launcher keeps current ChatGPT OAuth and tunnel settings. See `README.md` for the complete Vietnamese and English setup.
