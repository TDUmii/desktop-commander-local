# UmiBridge Sakura Console v0.1.0-beta.6

Verifies native Gemini web file and PowerShell operations and adds an optional experimental browser fallback. The successful native Task flow uses UmiBridge's existing eleven tools, private paired URL and request history, without a model API key, Gemini CLI or browser extension.

- Run `Setup-Gemini-Browser.cmd` to prepare the bridge, copy its private local connection URL and open the official extension listing and Gemini. Install the extension, select Streamable HTTP in its connection settings, then paste the clipboard URL there only. Insert the extension's working instructions into a new Gemini chat and review the first tool calls manually.
- CORS is limited to the exact credential-bearing paired route and the Gemini origin or official Chrome extension ID. Other origins, admin headers and unsupported preflight methods are rejected. The dashboard and regular OAuth route receive no new cross-origin access.
- The paired endpoint now uses streaming SSE responses and supports an authenticated GET stream with SDK keep-alives. The regular OAuth endpoint retains JSON responses. Regression checks verify SSE media types, GET authorization and a real tool call from an existing SDK client after a same-address server restart.
- Added regression coverage for allowed/denied preflights and actual MCP file read/write and command execution with the Gemini Origin header. Existing OAuth, refresh, restart, request history, skills and tunnel checks remain covered.
- Added `GEMINI-BROWSER.vi.md` with setup, revocation, third-party extension considerations and verification limits. Existing native Gemini setup and ChatGPT OAuth are retained.
- Browser setup runs in explicit local-only mode without a public tunnel, preserving the saved OAuth issuer/grants. It switches the running bridge to local mode; launch `Start-UmiBridge.cmd` to switch back to public access for ChatGPT. Local mode continues to work when a tunnel login expires.

## Verification status

Native Gemini web **Task / Flash** read a fixture marker not present in its prompt, created a new local file, read it back and executed PowerShell. Disk and gateway history independently confirmed the operations; the command exited 0 with the requested stdout marker and actual file size. Earlier attempts returned `Transport for env PROD not found in configuration`; calls succeeded after app configuration was refreshed/recreated, including through the original UmiBridge Sakura Console app. The exact earlier cause has not been isolated. See `GEMINI-VERIFICATION.md`.

All ten automated regression checks pass, including isolated local-only startup without a tunnel. They complement the live browser test. **The extension fallback remains experimental and has not passed an end-to-end Gemini test.** It was not required for the successful native flow.

Native execution remains intermittent: a later isolated attempt through the original app failed before reaching the gateway despite the successful samples. The transport error is not claimed to be fully resolved; see the current verification report for the successful operations and remaining stability limit.

The project does not bundle or modify MCP SuperAssistant. Its upstream code includes analytics and remote configuration; review extension permissions before installing. Keep automatic execution off for the first harmless test.

## Privacy and update

Extract the source ZIP and use `Install-UmiBridge.cmd` for a new installation. Existing users can replace source files while preserving their ignored local runtime state. Credential URLs, account identity, OAuth tokens, browser data, local logs and research checkouts are excluded from tracked source and release archives. Older releases remain available.
