# Desktop Commander Local for ChatGPT

This standalone project connects ChatGPT web to a Windows machine through a small OAuth-protected MCP bridge. It is intentionally scoped to ChatGPT web: there are no Claude setup files, editor plugins, remote-device modules, telemetry packages, PDF/office extras, or upstream release tooling.

The local backend exposes only these actions:

- read, write, edit, list, move, create directories and inspect file metadata;
- search text in local files;
- run a PowerShell command and return bounded output.

Every request sent through the bridge is recorded in a local-only admin page. Arguments are redacted before they are stored, and raw tool results are never written to the history file.

## Windows quick start

1. Install Node.js 22.12 or newer.
2. Run `Setup-Local.ps1` once. It installs the two small npm dependencies and downloads a checksum-verified `cloudflared` binary into the ignored `local-bin/` folder.
3. Double-click `Start-ChatGPT.cmd`.
4. Open the printed URL in ChatGPT's custom MCP server form, choose OAuth, enable Dynamic Client Registration, and keep the `desktop` and `offline_access` scopes enabled.
5. Enter the one-time connection code shown by the local tool on the consent page.
6. In a new ChatGPT conversation, select `@Desktop Commander Local PC`.

The local admin dashboard is available at `http://127.0.0.1:43127/admin` while the launcher is running. It includes request logs, outcome and latency metrics, tool usage charts, filters, and optional per-request ChatGPT conversation links. ChatGPT does **not** expose its conversation ID through this MCP bridge: chat links must be pasted and associated manually with the correct request. Use `Stop-ChatGPT.cmd` to stop the bridge and tunnel.

Quick Tunnel URLs are temporary. After restarting the launcher, reconnect ChatGPT with the new URL printed in the terminal.

## Privacy boundary

The OAuth secret, tokens, tunnel state, request history, downloaded tunnel binary, and machine-specific files live under `.local-data/` or `local-bin/`, both ignored by Git. The public repository contains source and setup instructions only. The admin page is loopback-only; `/admin` is unavailable through the public tunnel.

## Project layout

```text
scripts/chatgpt-backend.mjs      minimal MCP backend for ChatGPT
scripts/local-web-gateway.mjs    OAuth and Streamable HTTP bridge
scripts/local-admin.mjs          loopback request history page
scripts/run-local-web.mjs        Windows launcher and Quick Tunnel setup
test/local-gateway.test.mjs      OAuth, MCP, tool and admin regression test
```

This project is released under the MIT License.
