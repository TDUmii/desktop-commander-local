# Native Gemini web verification - 2026-10-20

## Verified flow

Gemini web's native custom MCP app was tested in **Task / Flash**, using UmiBridge's private paired URL through the saved HTTPS tunnel. No Gemini API key, Gemini CLI or browser extension was used for these successful calls.

| Operation | Independent evidence |
| --- | --- |
| Read a local fixture | Gemini returned a marker that was not included in its prompt; a matching `read_file` entry reached the gateway |
| Create a file | After Gemini's normal Allow confirmation, `write_file` created the requested file under the ignored local test directory; disk content matched the requested marker |
| Read the new file back | Gemini displayed the marker and the gateway recorded the corresponding read |
| Execute PowerShell | The normal Allow confirmation triggered `run_command`; its history record contained exit code 0, no timeout, empty stderr and the requested output marker plus the actual 29-byte file length |
| Restart and read a new fixture | After enabling streaming SSE, a new Task read a fresh marker after restart; another restart was followed by a successful read of a second fresh marker in the same chat, without reopening app configuration |

The test directory, conversation links, raw logs, account identity, screenshots and credential URLs are private runtime data, excluded from Git and source archives. Screenshots may be shown privately to the user after cropping account details.

## Earlier failure and recovery

Earlier native app attempts returned `Transport for env PROD not found in configuration` without reaching UmiBridge's tool handler. A read-only public DeepWiki app was added as a comparison and returned the requested sections for the upstream Desktop Commander repository. Its response matched an independent MCP query.

The saved UmiBridge URL was checked against the live server and matched. A fresh UmiBridge app configuration was then created using an equivalent paired URL with a non-secret query tag. Subsequent calls reached the server, including successful write and command calls through the original **UmiBridge Sakura Console** app. This establishes recovery on the tested account, but does not isolate whether the earlier cause was cached configuration, synchronization timing, or a transient upstream issue. No unproven server-side transport fix is claimed.

A subsequent server restart reproduced the transport error with the earlier JSON-only paired endpoint. A protocol comparison showed that the working DeepWiki endpoint returned streaming SSE and accepted an SSE GET stream. UmiBridge's paired endpoint was changed to use the SDK's SSE responses and GET keep-alives, while the regular ChatGPT OAuth endpoint retained JSON responses. The two live restart reads above then passed. These observations support the compatibility change on the tested account, but do not establish that every upstream configuration error has the same cause. An SDK regression also verifies that an existing client can call a tool after a same-address server restart.

If the error recurs, first verify the hidden server and current URL, then refresh/reconnect the custom app and test a harmless file in a new Task. Do not infer success from tool discovery alone. Avoid posting the private URL in chat or an issue report.

## Scope

**Remaining stability caveat:** after the successful operations and two restart reads, a final isolated attempt with only the original app connected failed before reaching the gateway. The native flow has demonstrated real execution but has not yet demonstrated consistent reliability. The stale app configuration is being replaced with a clean configuration; do not treat the successful samples alone as a guarantee that the transport error is resolved for every later call.

Automated regression checks cover OAuth, persisted grants, private-route authorization, history, browser CORS, skills and a separate local-only launcher with no tunnel dependency. Those checks complement the live Gemini test and are not counted as Gemini executions. The optional MCP SuperAssistant extension path remains experimental and was not required for the successful native flow.
