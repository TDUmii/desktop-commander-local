# UmiBridge Sakura Console v0.1.0-beta.5

Use the same personal Windows MCP bridge from ChatGPT and eligible Gemini web accounts. Gemini connects through its native custom-app interface, with the existing OAuth/DCR flow and persistent HTTPS endpoint. No model API key or browser extension is required.

- Added `Setup-Gemini.cmd`: checks or installs project prerequisites, builds the source, reuses the hidden local server, copies its current MCP endpoint to the local clipboard and opens Gemini's connected-app settings.
- Added optional `Setup-Gemini-Paired.cmd` for accounts where Google's embedded OAuth linking page stays blank. It creates a private 256-bit capability URL, stored only in protected local files. This URL is a reusable credential without OAuth token expiry; keep it private and delete its secret file then restart to revoke it. The regular `/mcp` endpoint continues to require OAuth.
- Added accurate read/write, destructive, idempotency and network-access MCP annotations for all eleven tools. Gemini controls its own confirmations for write actions.
- Request history now shows a Gemini, ChatGPT or generic MCP source badge based on the authenticated client's registered name. This is an informational label, never an authorization rule.
- Manual chat associations accept official Gemini conversation and shared-chat links, including copied `g.co/gemini/share/...` URLs, with strict local validation and continued support for existing ChatGPT links.
- Updated English and Vietnamese instructions for both web clients. The stable tunnel and persisted OAuth grants from beta.4 remain available to both.

## Install or update

Extract the source ZIP and run `Install-UmiBridge.cmd`. For a persistent address, run `Setup-Stable-Connection.cmd` once. Run `Setup-Gemini.cmd` to open Gemini setup, add the copied MCP URL, complete Google account linking and enter the local connection code on UmiBridge's authorization page. If that Google page remains blank, opt in to `Setup-Gemini-Paired.cmd` and paste its private URL only into Gemini's MCP configuration field. Daily launches use `Start-UmiBridge.cmd`.

Custom MCP apps depend on Google's account and rollout availability. Google's documentation currently requires a personal adult account, US availability, English and Keep Activity; the interface may differ by account. See the linked official requirements in the README. A successful build or DCR registration alone does not prove Gemini has completed authorization or called a tool.

Credentials, account identity, private endpoints, browser state, request history and local skill content are excluded from the source release. Source archives are built from tracked files only. Existing releases remain available.

## Validation

Automated checks cover the MCP tool annotations through a real stdio connection, authenticated client attribution and spoof resistance, known-credential redaction in command inputs and outputs, legacy history, Gemini/ChatGPT URL validation, localization, OAuth refresh/restart/revocation, exact private-route authorization and revocation, and tunnel configuration. Live browser authorization and tool calls are verified separately.
