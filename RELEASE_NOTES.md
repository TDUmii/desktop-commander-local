# UmiBridge Sakura Console v0.1.0-beta.12

Command execution uses a persistent hidden PowerShell host prepared when the backend or Agent starts. Incoming commands run sequentially through the ready host instead of creating a new CMD/PowerShell window for each request. The existing launcher monitor remains open, and MCP/dashboard output keeps the same stdout, stderr, exit-code and timeout fields.

Global PowerShell variables and environment changes can persist between ordinary calls. An explicit `cwd` selects the command's directory. Timeout, `exit`, or shell failure resets the worker before a later command; no timed-out command is replayed automatically.

`Start-Process` and its aliases now default to `-WindowStyle Hidden` inside the command session, including after a reset. Explicit `-NoNewWindow` and `-WindowStyle` choices remain supported. To intentionally show an application, specify `-WindowStyle Normal`. A Windows event-hook regression observes both console and Windows Terminal SHOW events, covering child process windows as well as the parent worker. The launcher reuses an existing stable tunnel/port instead of updating it on every startup and unnecessarily falling back to a temporary URL.

Native executables also receive default `PATHEXT` and `ComSpec` values when the MCP client's filtered environment omits them, preventing silent empty results. Windows checks cover PID reuse, hidden window state, Unicode paths, native stdout/stderr/exit codes, FIFO commands and timeout/exit recovery. Separate process-tree checks confirm timeout and abrupt parent shutdown leave no delayed test-file writes.

The Gemini browser verification from earlier releases remains historical evidence; this release description does not claim a new browser/model run.

## Previous beta.11

The dashboard no longer makes the gateway appear to stop at 500 requests. Total received, successful and failed counters now include all recorded calls since history was last cleared and are restored from the local append-only journal on restart. The 500-record window applies only to recent analytics; request 501 and later continue to execute. Clearing history resets the journal, counters and manually linked chats.

Latency, hourly charts and tool rankings are explicitly labelled as recent-history statistics. Regression coverage crosses 500 real MCP calls and checks continued execution, journal totals, restart restoration and reset behavior. This change does not claim a new Gemini browser/model verification; the earlier browser evidence remains documented separately.

The volume regression allows 30 seconds for Windows PowerShell startup on shared CI runners and reports the tool result if it fails. Runtime command limits remain configured by each caller.

## Previous beta.9

Beta.9 adds a small Hub/Agent layer for one account controlling multiple Windows computers while keeping the existing ChatGPT and Gemini gateway.

- The Hub keeps the tunnel, OAuth, local dashboard and bounded job history. Target computers run `Pair-Agent.cmd` once and `UmiBridge-Agent.cmd` afterward; each Agent connects outbound and never needs a public listening port.
- The Devices dashboard creates one-time pairing codes, shows online/offline state and recent jobs, copies device IDs and revokes credentials. Agent keys are hashed on the Hub and written only to each target's ignored `.local-data/agent-config.json`.
- MCP adds `list_devices`, `get_device_status`, `get_job_status` and the remote file/PowerShell tools. Every remote result includes the target `device_id`, hostname, job status and bounded stdout/stderr or file result.
- The Gemini browser setup now discovers 23 tools after reconnecting (11 local tools plus 12 device-routing tools); the existing Conversation / 4 Argon / High workflow remains supported.
- Regression coverage now includes two real Agent workers routed through the HTTP gateway, distinct command markers, file write/read checks against both target roots, dashboard job history and invalid credential rejection. The full local suite has fourteen existing checks plus the multi-device gateway check.
- Existing one-click `UmiBridge.cmd`, ChatGPT beta.4 Latest compatibility, Gemini OAuth/private pairing and the experimental browser extension remain unchanged. No credentials, URLs, browser data or local runtime state are included in the repository.

## Previous beta.8

The single-entry launcher `UmiBridge.cmd` now performs the daily lifecycle: safe fast-forward update for clean Git worktrees, runtime/build repair, saved Dev Tunnel health checks, expired-token renewal through GitHub sign-in, Quick Tunnel fallback when the Dev Tunnel login is unavailable, hidden gateway startup and local dashboard launch. ChatGPT and Gemini continue to share the same gateway without a provider switch.

The launcher terminal now remains open after startup and watches the protected request history, printing only a timestamp, tool name and status for each received request. The dashboard is a focused local workspace with separate Overview, Analytics, Linked chats, Skill Center, Request history and Settings views. Appearance, language, auto-refresh and refresh interval preferences are stored in browser local storage; gateway credentials and request data are untouched.

Gemini web can use the existing UmiBridge file and hidden PowerShell tools through the official MCP SuperAssistant browser extension. The recorded **Task / Flash** test read, created and edited local files, ran PowerShell, returned stdout/stderr/exit code to Gemini, and read fresh data after a gateway restart. No Gemini API key or additional npm proxy was used.

- Run `Setup-Gemini-Browser.cmd` to prepare the bridge, verify its authenticated local MCP connection, copy its private URL and open the official extension listing and Gemini. Install MCP SuperAssistant once, select **Server settings → Streamable HTTP**, paste the clipboard URL there only, then **Save & Reconnect**. Wait for **Server Connected** and eleven tools.
- CORS is limited to the exact credential-bearing paired route and the Gemini origin or official Chrome extension ID. Other origins, admin headers and unsupported preflight methods are rejected. The dashboard and regular OAuth route receive no new cross-origin access.
- The paired endpoint now uses streaming SSE responses and supports an authenticated GET stream with SDK keep-alives. The regular OAuth endpoint retains JSON responses. Regression checks verify SSE media types, GET authorization and a real tool call from an existing SDK client after a same-address server restart.
- Regression coverage includes the official extension Origin, unauthorized origins, valid setup diagnostics and stale-credential refusal, alongside actual MCP file and command calls. Existing OAuth, refresh, restart, request history, skills and tunnel checks remain covered.
- Stable tunnel repair now probes the project API instead of trusting the cached `user show` status. When Microsoft reports an expired login token, the launcher renews the GitHub session, rewrites the small tunnel config with a Windows-compatible move and restarts the gateway on the same host. This keeps existing ChatGPT OAuth connections valid after token expiry.
- Choose **Task → Flash** and use `GEMINI-EXTENSION-PROMPT.md`. Review each card, select **Run**, then **Insert**, wait for the result to appear and press Gemini's send button. See `GEMINI-BROWSER.vi.md` for Vietnamese setup and `GEMINI-EXTENSION-VERIFICATION.md` for evidence and limits.
- Browser setup runs in explicit local-only mode without a public tunnel, preserving the saved OAuth issuer/grants. It switches the running bridge to local mode; launch `UmiBridge.cmd` to switch back to public access for ChatGPT. Local mode continues to work when a tunnel login expires.

## Verification status

The extension test used Gemini-generated calls and actual **Run** actions. File contents and gateway history independently confirmed the operations. Gemini received the real stdout, stderr and exit code 0. After restarting the local gateway, the existing extension chat read a newly changed marker successfully.

All thirteen automated regression checks pass, including isolated local-only startup without a tunnel and the dashboard/launcher assertions. They complement the live browser test. Chat mode returned a provider response error or stalled in the tested attempts; Task/Flash completed the recorded operations. These samples do not guarantee every account/model or continuous availability.

Native custom-app execution remains intermittent and is documented separately in `GEMINI-VERIFICATION.md`; this release does not claim to fix that transport. The successful flow here uses the extension instead.

The project does not bundle or modify MCP SuperAssistant. Its upstream code includes analytics and remote configuration; review extension permissions before installing. Automatic execution, insertion and submission remain off in the verified manual setup.

## Privacy and update

Extract the source ZIP and use `UmiBridge.cmd` for a new installation or daily start. Existing users can replace source files while preserving their ignored local runtime state. Credential URLs, account identity, OAuth tokens, browser data, local logs and research checkouts are excluded from tracked source and release archives. Older releases remain available.

This is an experimental prerelease. **v0.1.0-beta.4 remains GitHub Latest for ChatGPT.**
