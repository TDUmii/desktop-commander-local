# UmiBridge Sakura Console v0.1.0-beta.6

Adds an experimental Gemini web fallback through the open-source MCP SuperAssistant browser extension. It reuses UmiBridge's existing eleven tools and request history through a private loopback Streamable HTTP URL, without installing another npm proxy or requiring a model API key.

- Run `Setup-Gemini-Browser.cmd` to prepare the bridge, copy its private local connection URL and open the official extension listing and Gemini. Install the extension, select Streamable HTTP in its connection settings, then paste the clipboard URL there only. Insert the extension's working instructions into a new Gemini chat and review the first tool calls manually.
- CORS is limited to the exact credential-bearing paired route and the Gemini origin or official Chrome extension ID. Other origins, admin headers and unsupported preflight methods are rejected. The dashboard and regular OAuth route receive no new cross-origin access.
- Added regression coverage for allowed/denied preflights and actual MCP file read/write and command execution with the Gemini Origin header. Existing OAuth, refresh, restart, request history, skills and tunnel checks remain covered.
- Added `GEMINI-BROWSER.vi.md` with setup, revocation, third-party extension considerations and verification limits. Existing native Gemini setup and ChatGPT OAuth are retained.
- Browser setup runs in explicit local-only mode without a public tunnel, preserving the saved OAuth issuer/grants. It switches the running bridge to local mode; launch `Start-UmiBridge.cmd` to switch back to public access for ChatGPT. Local mode continues to work when a tunnel login expires.

## Verification status

Local automated checks exercise real MCP operations, but do not prove Gemini web executed them. In the earlier native custom-app test, Gemini listed eleven tools but write/command attempts failed with `Transport for env PROD not found in configuration` before reaching the gateway. During beta.6 preparation, Chrome control allowed reading tabs but rejected tab creation/navigation, preventing extension installation and live Gemini testing. **The extension path is experimental and has not passed an end-to-end Gemini test.** No Google-side repair is claimed.

The project does not bundle or modify MCP SuperAssistant. Its upstream code includes analytics and remote configuration; review extension permissions before installing. Keep automatic execution off for the first harmless test.

## Privacy and update

Extract the source ZIP and use `Install-UmiBridge.cmd` for a new installation. Existing users can replace source files while preserving their ignored local runtime state. Credential URLs, account identity, OAuth tokens, browser data, local logs and research checkouts are excluded from tracked source and release archives. Older releases remain available.
