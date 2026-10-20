# UmiBridge Sakura Console v0.1.0-beta.4

ChatGPT could stop connecting after a restart or after a 15-minute access-token expiry. The old Quick Tunnel address was still saved in ChatGPT, and a desktop-only OAuth request did not receive a refresh token.

- Added `Setup-Stable-Connection.cmd`: one-time GitHub sign-in for Microsoft Dev Tunnels, signed project-local CLI, persistent tunnel identity and background startup. No purchased domain is required.
- The launcher reads the actual public address from the tunnel host and checks it against the saved address on later launches. It preserves Host and Origin so the public tunnel cannot become a loopback admin request.
- Persisted issuer-bound OAuth registrations and token grants under protected `.local-data`. Consent requests and one-time authorization codes remain memory-only.
- Added rotating 30-day refresh tokens for clients that advertise the refresh grant, including ChatGPT requests using only `desktop` scope. Revocation survives restart.
- Kept the optional Cloudflare Quick Tunnel flow with an explicit temporary-address warning.

## Install or update

Extract the source ZIP and run `Install-UmiBridge.cmd`. For a persistent address, run `Setup-Stable-Connection.cmd`, finish GitHub sign-in and authorize the resulting `/mcp` endpoint in ChatGPT once. Use `Start-UmiBridge.cmd` for daily background startup. Existing temporary-address ChatGPT apps must be replaced with a connection pointing to the fixed address.

The local `.runtime` and `.local-data` directories, credentials, account identity and request history are excluded from the source release. Dev Tunnels is a Microsoft public preview service; inactive resources may expire after 30 days.

## Validation

Build and regression tests cover desktop-only refresh, real gateway restarts, rotation and revocation, issuer separation, malformed-state refusal, tunnel-output parsing and unsafe configuration. Live transport and ChatGPT checks are performed separately from these automated tests.
