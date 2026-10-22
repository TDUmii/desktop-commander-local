# Gemini extension verification - 21 October 2026

## Scope and result

The official Chrome Web Store MCP SuperAssistant was installed in the existing browser. The recorded browser run connected directly to UmiBridge over private loopback Streamable HTTP and discovered the original 11 local tools. Beta.9 adds 12 device-routing tools, so the extension must be **Save & Reconnect**ed to reload the current 23-tool list; the full browser run below covers the original local operations, while the new Hub/Agent path is verified separately by the automated and live MCP checks. No Gemini API key, native custom app, additional MCP proxy, or new AI agent backend was needed for the successful flow.

Gemini web **Task / Flash** and **Conversation / 4 Argon / High** generated the calls. The extension rendered their parameters and executed them after its **Run** button was selected. Results were inserted into the same Gemini conversation; they were not fabricated or supplied by a separate SDK test.

| Check | Observed result |
| --- | --- |
| Read a local fixture | Returned a marker not contained in the request prompt; local request history recorded `read_file`, status `ok`. Gemini subsequently repeated the actual marker. |
| Create a disposable file | `write_file` created the requested content; the extension reported 28 bytes and `rewrite` mode. Disk content and local history agreed. |
| Edit the file | `edit_block` replaced the one requested marker. Reading the disk independently confirmed the final content. |
| Run PowerShell | `run_command` read the edited file and printed a separate stdout marker. The result contained `exit_code: 0`, `timed_out: false`, the actual final file content and an intentional stderr test line. Local history independently recorded exit code 0 and both output streams. |
| Return results to Gemini | Extension **Insert** placed the actual results in the input. Gemini summarized stdout, stderr and exit code correctly. |
| Custom-instruction recovery | With the extension still connected, Gemini initially returned its generic “cannot access a local drive” answer. After enabling the documented Custom Instructions and using Task / Flash, `list_directory` on `D:/Code/Linh tinh/NekoNest` returned the real seven entries; Gemini received them through **Insert** and summarized the project structure. |
| Gemini 4 Argon High | In a fresh **Conversation** chat, selecting **4 Argon → Thinking level → High** produced the same `list_directory` card. **Run** returned the real seven entries, **Insert** fed the result back into Gemini, and Gemini correctly summarized the three directories and four files. |
| Restart and reconnect | The updated setup stopped only UmiBridge, relaunched it hidden in local mode and passed its authenticated tool-discovery check. After **Reconnect**, the original extension chat read a newly changed fixture marker with its existing read card. Local history recorded a new successful read. |
| Incorrect authentication/origins | Automated checks reject wrong or rotated capability URLs, untrusted page/extension origins, unsupported preflights, path aliases and cross-origin admin access. They also exercise the official extension Origin and setup diagnostic against a real gateway. |
| OAuth regression | Automated refresh, rotation, revocation, issuer isolation and same-address restart tests passed. Local startup preserves saved OAuth state and needs no tunnel. |

PowerShell uses the existing backend's `windowsHide: true` child process. Its output appeared on the extension card and in local request history; there was no separate visible command terminal used for tool execution. Setup itself is a brief visible bootstrap step; the gateway remains in the background.

## Changes in beta.7

- The browser setup runs an authenticated loopback health/tool-discovery check before copying the private connection and opening Gemini. A stale secret or missing required tool fails setup without printing the credential.
- Regression coverage includes the official Chrome extension Origin, an unauthorized extension Origin, a valid setup check and stale-credential refusal.
- The short prompt and Vietnamese manual document the exact **Run → Insert → Send** workflow. It was exercised with both Task/Flash and **Conversation / 4 Argon / High**.
- The one-time Custom Instructions recipe is documented separately so the common generic local-drive refusal can be corrected without changing the gateway or exposing a pairing URL.

## Limits

Earlier Chat attempts without the Custom Instructions returned a general Gemini response error, and a Flash-Lite Chat attempt stalled. With the instructions enabled, **Conversation / 4 Argon / High** completed the recorded directory operation. Task/Flash also completed the broader file and command checks. These observations do not establish continuous availability or universal compatibility across accounts/models. Native custom-app transport issues are separate and remain documented in `GEMINI-VERIFICATION.md`.

The extension is third-party software, not an UmiBridge-owned extension. Its permissions, updates and remote configuration remain controlled upstream. Auto Execute, Auto Insert and Auto Submit were left off for the verified manual flow. Local-only mode does not provide the remote ChatGPT tunnel; run `Start-UmiBridge.cmd` to return to public mode.

Only disposable test data was used. Private URLs, account identity, OAuth grants, request logs, browser state and screenshots remain outside Git and release archives. The public release is a prerelease on the experimental branch; ChatGPT beta.4 stays Latest.
