# UmiBridge Sakura Console v0.1.0-beta.19

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
