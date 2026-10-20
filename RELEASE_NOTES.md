# UmiBridge Sakura Console v0.1.0-beta.7

Gemini web can use the existing UmiBridge file and hidden PowerShell tools through the official MCP SuperAssistant browser extension. The recorded **Task / Flash** test read, created and edited local files, ran PowerShell, returned stdout/stderr/exit code to Gemini, and read fresh data after a gateway restart. No Gemini API key or additional npm proxy was used.

- Run `Setup-Gemini-Browser.cmd` to prepare the bridge, verify its authenticated local MCP connection, copy its private URL and open the official extension listing and Gemini. Install MCP SuperAssistant once, select **Server settings → Streamable HTTP**, paste the clipboard URL there only, then **Save & Reconnect**. Wait for **Server Connected** and eleven tools.
- CORS is limited to the exact credential-bearing paired route and the Gemini origin or official Chrome extension ID. Other origins, admin headers and unsupported preflight methods are rejected. The dashboard and regular OAuth route receive no new cross-origin access.
- The paired endpoint now uses streaming SSE responses and supports an authenticated GET stream with SDK keep-alives. The regular OAuth endpoint retains JSON responses. Regression checks verify SSE media types, GET authorization and a real tool call from an existing SDK client after a same-address server restart.
- Regression coverage includes the official extension Origin, unauthorized origins, valid setup diagnostics and stale-credential refusal, alongside actual MCP file and command calls. Existing OAuth, refresh, restart, request history, skills and tunnel checks remain covered.
- Choose **Task → Flash** and use `GEMINI-EXTENSION-PROMPT.md`. Review each card, select **Run**, then **Insert**, wait for the result to appear and press Gemini's send button. See `GEMINI-BROWSER.vi.md` for Vietnamese setup and `GEMINI-EXTENSION-VERIFICATION.md` for evidence and limits.
- Browser setup runs in explicit local-only mode without a public tunnel, preserving the saved OAuth issuer/grants. It switches the running bridge to local mode; launch `Start-UmiBridge.cmd` to switch back to public access for ChatGPT. Local mode continues to work when a tunnel login expires.

## Verification status

The extension test used Gemini-generated calls and actual **Run** actions. File contents and gateway history independently confirmed the operations. Gemini received the real stdout, stderr and exit code 0. After restarting the local gateway, the existing extension chat read a newly changed marker successfully.

All ten automated regression checks pass, including isolated local-only startup without a tunnel. They complement the live browser test. Chat mode returned a provider response error or stalled in the tested attempts; Task/Flash completed the recorded operations. These samples do not guarantee every account/model or continuous availability.

Native custom-app execution remains intermittent and is documented separately in `GEMINI-VERIFICATION.md`; this release does not claim to fix that transport. The successful flow here uses the extension instead.

The project does not bundle or modify MCP SuperAssistant. Its upstream code includes analytics and remote configuration; review extension permissions before installing. Automatic execution, insertion and submission remain off in the verified manual setup.

## Privacy and update

Extract the source ZIP and use `Install-UmiBridge.cmd` for a new installation. Existing users can replace source files while preserving their ignored local runtime state. Credential URLs, account identity, OAuth tokens, browser data, local logs and research checkouts are excluded from tracked source and release archives. Older releases remain available.

This is an experimental prerelease. **v0.1.0-beta.4 remains GitHub Latest for ChatGPT.**
