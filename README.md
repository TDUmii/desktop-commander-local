<div align="center">

<img src="assets/umibridge-banner.svg" alt="UmiBridge Sakura Console: personal Windows MCP bridge for ChatGPT and Gemini" width="100%">

# UmiBridge · Sakura Console

**Your PC. Your skills. Your command center.**

A personal Windows MCP bridge connecting ChatGPT and Gemini on the web to your files and PowerShell, with a private anime-inspired dashboard and an optional local Codex Skill Center.

**[English](#english) · [Tiếng Việt](#tieng-viet) · [Releases](https://github.com/TDUmii/umi-bridge/releases) · [Vietnamese user manual](LOCAL-README.vi.md)**

</div>

---

<a id="english"></a>

## English

> [!WARNING]
> **Beta software - powerful local access.** After you authorize the MCP connection, your connected assistant can read and modify local files and run PowerShell commands on your computer. Use trusted accounts, verify actions before allowing them, and back up important files. Never disclose your connection code, credentials, tokens, or private local logs.

### What is UmiBridge?

UmiBridge runs an MCP server on your Windows computer and connects it to ChatGPT or Gemini through HTTPS. OAuth is the standard connection; Gemini also has an optional private paired URL. A persistent Microsoft Dev Tunnel is recommended, with Cloudflare Quick Tunnel available for temporary use. Both assistants use the same server and tunnel. Its **Sakura Console** dashboard is available *only on the local computer*.

Connect through each product's native custom MCP app settings. **No model API key or browser extension is needed** when your account has access to that feature.

| Feature | What you get |
| --- | --- |
| Local file tools | Read, write, edit, move, search, inspect, and create files or directories |
| Shell tools | Execute PowerShell commands and retrieve bounded output |
| MCP authorization | OAuth, PKCE, Dynamic Client Registration (DCR), scoped tokens |
| Optional Gemini pairing | A private credential URL for accounts where Google's OAuth linking cannot complete |
| Web assistants | Native custom MCP connections for ChatGPT and eligible Gemini accounts |
| Sakura Console | English-by-default admin UI, optional Vietnamese switch, light/dark themes |
| Analytics | Request history, tool usage, outcome counts, average/P95 latency and a 12-hour activity chart |
| Chat associations | Manually attach a ChatGPT or Gemini conversation/share link to a request |
| Skill Center | Discover installed Codex/Agents skills, preview SKILL.md, enable/disable them, and add custom skill folders |

**Important:** MCP does not identify the conversation that produced a request. Provider labels identify the connected client; chat associations must be created manually. Enabling a skill does not execute its scripts.

### Requirements

- **Windows 10 or Windows 11 (x64)** and an internet connection.
- Node.js 22.12.0 or newer is optional. The one-click installer downloads the latest official Windows x64 LTS runtime when a compatible Node.js is not already available.
- A ChatGPT or Gemini account with access to **custom MCP apps**; the standard connection uses OAuth. See the provider-specific setup below for current availability.

No Python, Docker, IDE, or Administrator account is required. The GitHub ZIP contains the source and a one-click bootstrap installer; it is not an MSI or a system-wide Windows installer.

### Install on a new Windows computer

**1. Download the source.** Choose **Code → Download ZIP** from [the repository](https://github.com/TDUmii/umi-bridge), extract it to a normal folder, or clone it:

~~~powershell
git clone https://github.com/TDUmii/umi-bridge.git
cd umi-bridge
~~~

**2. Install and start with one click.** Open the extracted folder and double-click **`Install-UmiBridge.cmd`**. It automatically:

1. Uses a compatible system Node.js, or downloads the latest official Node.js LTS runtime into the project only.
2. Installs the locked npm dependencies with `npm ci`.
3. Checks the JavaScript source.
4. Downloads the Windows x64 Cloudflare Tunnel binary and verifies its SHA-256 digest.
5. Starts UmiBridge and opens the local dashboard.

The first run needs internet access. It does not change the system PowerShell execution policy or install files globally.

The first run keeps a console window visible so you can copy the HTTPS Server URL and connection code for OAuth. After the connection is authorized, use **`Start-UmiBridge.cmd`** for daily use: it starts the bridge in the background, opens `/admin`, and writes diagnostics only to `.local-data/server.log` and `.local-data/server-error.log`.

For an advanced/manual setup, run the following in the directory containing `Setup-Local.ps1`:

~~~powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Setup-Local.ps1
~~~

`Setup-Local.ps1` performs the same steps without launching the server. Double-click `Start-ChatGPT.cmd` afterward for the first OAuth connection. Keep its console window open while copying the HTTPS **Server URL** ending in `/mcp`, OAuth/DCR details, your locally generated connection code, and the private dashboard address. After OAuth is complete, use `Start-UmiBridge.cmd` so the server runs hidden and the dashboard opens without covering the screen.

### Set up a persistent connection (recommended)

Double-click **`Setup-Stable-Connection.cmd`** once before creating your ChatGPT or Gemini app. It installs the signed Microsoft Dev Tunnels client, opens GitHub sign-in, creates a persistent tunnel and restarts UmiBridge in the background. No domain purchase is needed. Use the `/mcp` URL from the local dashboard and the connection code in `.local-data/CONNECT.txt`. A browser may show Microsoft's first-visit tunnel notice; review it yourself before continuing to OAuth. Daily launches continue to use `Start-UmiBridge.cmd`.

If ChatGPT already uses your persistent endpoint, reuse it for Gemini OAuth. Optional Gemini pairing uses a private path on the same tunnel. There is no second server or tunnel to configure.

### Connect to ChatGPT

1. In ChatGPT, open **Settings → Plugins/Apps / custom MCP connectors** (actual wording may vary by plan and release).
2. Add a new custom MCP server, optionally naming it **UmiBridge**.
3. Copy the exact HTTPS **Server URL** ending in `/mcp` from the local dashboard.
4. Select **OAuth** with **Dynamic Client Registration (DCR)**. Leave Client ID / Client Secret blank if registration is automatic.
5. Select the `desktop` and `offline_access` scopes if the interface offers them.
6. Follow the consent flow and enter the connection code on UmiBridge's authorization page. Keep the code out of the conversation.
7. Test the connection by asking ChatGPT to **read a non-sensitive file**.

Without stable setup, Quick Tunnel URLs can change after every restart. A reconnect button cannot repair a deleted hostname: create a connection with the current URL. With a persistent Dev Tunnel, both the URL and issuer-bound OAuth grants survive restarts. Access tokens last 15 minutes and rotate through a refresh token valid for up to 30 days; clients advertising the refresh grant receive one even when they request only `desktop` scope. Revocation is persisted. Pending consent and single-use codes are never restored after restart.

Microsoft Dev Tunnels is a public preview service and needs a valid Microsoft/GitHub sign-in. Microsoft removes a tunnel after 30 days without activity. If hosting login expires, rerun `Setup-Stable-Connection.cmd`; it reuses the same tunnel. See [Microsoft's CLI reference](https://learn.microsoft.com/en-us/azure/developer/dev-tunnels/cli-commands) and [FAQ](https://learn.microsoft.com/en-us/azure/developer/dev-tunnels/faq). For ChatGPT's current menus and account policies, see [OpenAI's custom MCP guide](https://developers.openai.com/api/docs/guides/custom-mcp-server).

### Connect to Gemini on the web

1. Double-click **`Setup-Gemini.cmd`**. It checks dependencies, starts or reuses UmiBridge in the background, copies the current connection URL to your clipboard, and opens [Gemini Connected Apps in English](https://gemini.google.com/customize/connectors?hl=en). It uses OAuth `/mcp` unless private pairing is already configured.
2. Find **Custom apps → Add a custom app**. Some accounts show localized controls such as **Tùy chỉnh → Tạo ứng dụng tùy chỉnh**.
3. Paste the endpoint and select **Next / Tiếp theo**. UmiBridge supports DCR, so you can leave advanced Client ID and Client Secret fields empty.
4. For OAuth, complete Google's account-linking and consent screens. Enter the connection code on UmiBridge's authorization page if prompted; find it in `.local-data/CONNECT.txt` or the visible `Start-ChatGPT.cmd` terminal. The dashboard shows the endpoint, not the code.
5. Open a Gemini chat or task, type `@`, and select the connected UmiBridge app. Start by asking it to read a non-sensitive file in your project.
6. Review Gemini's confirmation before allowing file changes or commands. Google currently requires manual confirmation for write actions.

Google's published Custom Apps requirements currently specify a personal Google Account, age 18+, US availability, English, and Keep Activity enabled. Rollout and localized UI can vary by account; verify that **Custom apps** is visible on your account. A missing menu cannot be enabled by changing UmiBridge. See [Google's current Custom Apps guide](https://support.google.com/gemini/answer/17209137). This is the Gemini web integration; it does not require Gemini CLI or a Gemini API key.

**Optional private pairing:** if Google's OAuth account-linking window stays blank, run **`Setup-Gemini-Paired.cmd`**. It creates a 32-byte random secret in protected `.local-data/gemini-pairing-secret.txt`, restarts this bridge while preserving existing OAuth grants, and copies the exact private URL stored in `.local-data/GEMINI-CONNECT.txt`. Paste it **only into Gemini's MCP Server URL field**, then review the normal custom-app risk confirmation. This connection uses `/gemini/<random>/mcp` directly instead of a separate OAuth account-linking flow. Later runs of `Setup-Gemini.cmd` reuse the configured paired URL.

**Treat the entire paired URL like a password.** Anyone who has it can use the exposed tools. It has no OAuth expiry, refresh cycle, or per-client grant; it stays usable until revoked. Keep it out of chats, screenshots and source control. To revoke it, delete `.local-data/gemini-pairing-secret.txt`, run `Stop-ChatGPT.cmd`, then `Start-UmiBridge.cmd`. You can then reconnect Gemini with the regular OAuth endpoint. The regular `/mcp` route continues to require OAuth.

**Gemini beta limitation:** discovery and saving the custom app can succeed while execution still fails in Gemini. A live check observed the app's eleven tools and a successful backend read, but a subsequent Task reported that the production transport was missing from its connector configuration. Full file-write and PowerShell execution from Gemini has not been confirmed on that account. A successful local test or a connected-app badge alone is not an end-to-end Gemini result; this beta keeps that limitation explicit. No server-side fix for that Google-side message has been established.

### Sakura Console - languages, analytics and chat links

On the same Windows computer, open **http://127.0.0.1:43127/admin**. The dashboard cannot be opened through the public tunnel.

The interface **defaults to English**. Use the **English / Tiếng Việt** language selector in the top bar to switch instantly. Your selection is saved in this browser, and the language changes independently of the light/dark theme.

From the sidebar, you can browse Overview, Analytics, Linked chats, Skill Center and Request history. Search and filter requests, inspect redacted arguments and copy your connection endpoint. Auto-refresh runs every 20 seconds when enabled.

Request history displays the client/provider where available. To associate a chat, open **Request history → Details / Chat**, paste its ChatGPT or Gemini conversation/share URL, then choose **Save link**. Supported forms include `https://chatgpt.com/c/...`, `https://chatgpt.com/share/...`, `https://gemini.google.com/app/...`, `https://gemini.google.com/share/...`, and Gemini's copied short link `https://g.co/gemini/share/...`. The conversation ID is extracted only from the URL that *you* supplied. You can unlink it at any time.

### Skill Center - built in, expandable and local

Skills are detected from the current machine's common directories:

- `%USERPROFILE%\.codex\skills`
- `%USERPROFILE%\.agents\skills`
- `.agents/skills` inside the project directory
- Any absolute local skill folder you explicitly add from the dashboard

UmiBridge recognizes these **seven suggested skill names** when installed: `ui-ux-pro-max`, `impeccable`, `frontend-checklist-global`, `playwright-cli`, `ponytail`, `api-security-testing`, and `find-security-vulnerabilities-in-code`. Recommended skills default to enabled when discovered; other skills default to disabled until you enable them.

To add your own skill, create/download a trusted folder containing `SKILL.md`, open **Skill Center**, enter its absolute folder path and select **Add skill**. You can preview, enable/disable, or unlink it without deleting the original source.

Through MCP, ChatGPT or Gemini can use `list_skills` and `read_skill` to list and read the instructions of enabled skills. **Scripts do not execute automatically.** Skill instructions are untrusted content; review them before asking the assistant to run commands. Do not store secrets inside SKILL.md.

### Stop, restart and troubleshoot

To restart, run `Stop-ChatGPT.cmd`, wait for the stop confirmation, then run `Start-UmiBridge.cmd` again. Use `Start-ChatGPT.cmd` when you need to see the connection URL and startup diagnostics. Refresh the dashboard with **Ctrl + Shift + R** if you still see an older version.

| Symptom | What to do |
| --- | --- |
| `EADDRINUSE` or an occupied named pipe | Run `Stop-ChatGPT.cmd` before restarting; do not kill every `node.exe` |
| `node` / `npm` command not found | Double-click `Install-UmiBridge.cmd` again with internet access; it installs a project-local Node.js runtime automatically |
| `cloudflared.exe` is missing | Rerun `Setup-Local.ps1` with internet access |
| Background start fails | Read `.local-data/server-error.log`, then run `Start-ChatGPT.cmd` once to see the startup error |
| Dashboard will not load | Confirm the launcher is running and open the loopback URL on the host computer |
| ChatGPT reports a 401 or connection failure | Verify the saved `/mcp` URL matches the dashboard. Run `Setup-Stable-Connection.cmd` for a persistent address, then authorize the matching app once |
| Gemini has no Custom apps section | Check Google's current eligibility and account rollout. UmiBridge cannot turn on a product feature that your account does not expose |
| Gemini cannot connect | Rerun `Setup-Gemini.cmd` to copy the live URL, complete the selected connection flow, and keep UmiBridge running |
| Google's OAuth linking window stays blank | Try the optional `Setup-Gemini-Paired.cmd` flow above; keep its credential URL private |
| Browser says `DNS_PROBE_FINISHED_NXDOMAIN` | The old temporary hostname no longer exists. Reconnecting that app will not change its URL; create a new connection with the current endpoint |
| Skill does not appear | Check the directory contains a regular `SKILL.md` file no larger than 128 KiB; add it manually if outside the standard folders |
| The UI is not in English | Select **English** in the top bar; the default applies until a browser-specific preference is saved |

### Privacy and security

- The admin dashboard is **loopback-only**. The public HTTPS tunnel exposes the OAuth-protected MCP service, **not** your dashboard.
- Runtime credentials, OAuth state, request history, chat associations and skill preferences are stored under `.local-data/`, which is excluded from version control.
- Optional Gemini pairing credentials, including `gemini-pairing-secret.txt` and `GEMINI-CONNECT.txt`, also stay under `.local-data/` and must not be shared.
- OAuth clients and token grants are stored atomically under the local account's protected directory and are accepted only for their original issuer. Keep this directory private; deleting `oauth-state.json` requires OAuth authorization again.
- `.runtime/`, `node_modules/` and the downloaded `local-bin/` are also ignored and excluded from source releases.
- Keep browser profiles, account data, personal tunnel URLs and runtime logs out of source bundles and public bug reports.
- Recorded request arguments use **best-effort redaction**, not guaranteed removal of arbitrary secrets embedded inside commands or strings. Avoid sending secrets inside tool inputs.
- `run_command` history stores the command, working directory, exit code and bounded `stdout`/`stderr` locally so you can inspect it in `/admin`; output is capped and receives basic secret/path redaction.
- History is bounded to 500 stored entries, and the dashboard lists recent requests; it is **not a conversation archive**.
- Only the user-selected enabled skill's SKILL.md text is sent to the authorized MCP client when requested. Personal skill folders are **not uploaded to this repository**.
- You may disconnect OAuth authorization and stop the launcher at any time.

### Build and test

~~~powershell
npm ci --ignore-scripts --no-audit --no-fund
npm run build
npm run local:test
~~~

Project files: `scripts/chatgpt-backend.mjs` (MCP tools), `scripts/local-web-gateway.mjs` (OAuth and admin API), `scripts/local-admin.mjs` (request logging and chat associations), `scripts/skill-library.mjs` (local skills), `scripts/admin-dashboard.html` (dashboard), and `scripts/admin-i18n.js` (language switch).

**License:** [MIT](LICENSE) · **Status:** Beta (one-click bootstrap available; no system-wide MSI installer).

---

<a id="tieng-viet"></a>

# UmiBridge ✿ Sakura Console - Hướng dẫn sử dụng chi tiết

**Phiên bản:** v0.1.0-beta.5 (thử nghiệm). **Hệ điều hành:** Windows 10/11 x64.
**Repository:** https://github.com/TDUmii/umi-bridge  
**English / Tiếng Việt:** [README.md](README.md) (English first, Vietnamese below)
**Điều khiển:** ChatGPT web và Gemini web (MCP, OAuth hoặc URL ghép nối Gemini riêng). **Quản trị:** http://127.0.0.1:43127/admin

> [!WARNING]
> Dự án cho phép trợ lý đã kết nối thao tác với file và thực thi PowerShell trên máy đã xác thực. Chỉ cấp quyền cho tài khoản bạn tin cậy. Nên sao lưu dữ liệu quan trọng, không tiết lộ mã kết nối và chỉ chạy lệnh mà bạn đã hiểu rõ.

UmiBridge dùng kết nối MCP tùy chỉnh có sẵn trong ChatGPT hoặc Gemini. **Không cần API key của mô hình hay tiện ích trình duyệt** khi tài khoản có tính năng này. Hai dịch vụ dùng chung server và tunnel; OAuth dùng `/mcp`, Gemini có thêm URL ghép nối riêng tùy chọn. Dashboard vẫn chỉ mở trên máy local.

## 1. Cài lần đầu trên một máy Windows khác

### Chuẩn bị

- Windows 10/11 x64, Internet.
- Có Internet để chạy bộ cài một lần. Node.js **22.12.0+** là tùy chọn; nếu máy chưa có bản phù hợp, `Install-UmiBridge.cmd` sẽ tự tải bản LTS Windows x64 chính thức vào thư mục dự án.
- Tài khoản ChatGPT hoặc Gemini có quyền thêm ứng dụng MCP tùy chỉnh. Kết nối thông thường dùng OAuth; điều kiện và lựa chọn Gemini được nêu tại mục 3.

- Không cần Python, Docker, VS Code hay quyền Administrator cố định. Nếu máy công ty áp dụng chính sách hạn chế cài đặt/chạy PowerShell, bạn cần làm đúng quy định quản trị của máy.

### Tải mã nguồn

Tại GitHub, chọn **Code → Download ZIP**, sau đó giải nén vào thư mục thông thường (ví dụ `D:\Tools\UmiBridge`). Cũng có thể sử dụng Git:

~~~powershell
git clone https://github.com/TDUmii/umi-bridge.git
cd umi-bridge
~~~

### Cài đặt một lần bằng cách nhấp đúp

Mở thư mục đã giải nén và nhấp đúp **`Install-UmiBridge.cmd`**. Không cần mở PowerShell và không cần cài Node.js trước. Bộ cài sẽ tự:

1. Dùng Node.js sẵn có nếu đạt phiên bản tối thiểu, hoặc tải Node.js LTS chính thức vào `.runtime/`.
2. Cài dependency đúng theo `package-lock.json`.
3. Kiểm tra cú pháp mã nguồn.
4. Tải `cloudflared.exe` Windows x64 và kiểm tra SHA-256.
5. Khởi chạy UmiBridge rồi mở dashboard local.

Lần đầu cần Internet. Bộ cài không đổi execution policy toàn hệ thống và không cài phần mềm vào `Program Files`.

Lần đầu bộ cài vẫn giữ một cửa sổ console để bạn sao chép `Server URL` và mã kết nối cho OAuth. Sau khi kết nối xong, dùng **`Start-UmiBridge.cmd`** cho các lần chạy hằng ngày: server chạy nền, dashboard tự mở và log chỉ ghi vào `.local-data/server.log` cùng `.local-data/server-error.log`.

### Thiết lập thủ công nâng cao

Mở PowerShell tại thư mục chứa `Setup-Local.ps1`, chạy:

~~~powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Setup-Local.ps1
~~~

Script thực hiện các bước giống bộ cài một lần nhưng không tự mở server.

Sau khi cài sẽ xuất hiện `.runtime/`, `node_modules/` và `local-bin/` trên máy. Các thư mục này không được đưa lên GitHub.

### Chạy

Lần đầu bộ cài sẽ mở `Start-ChatGPT.cmd`. Chờ thông báo `Server URL`, `Authentication: OAuth` và mã kết nối để kết nối ChatGPT. Sau khi OAuth hoàn tất, dùng `Start-UmiBridge.cmd` để server chạy ẩn và dashboard tự mở, không che màn hình. Dùng lại `Start-ChatGPT.cmd` khi cần xem URL hoặc lỗi khởi động.

## 2. Kết nối ChatGPT bằng OAuth

**Khuyến nghị dùng địa chỉ cố định cho cả ChatGPT và Gemini:** nhấp đúp **`Setup-Stable-Connection.cmd`** một lần trước khi thêm ứng dụng. Script tải Dev Tunnels chính thức của Microsoft, kiểm tra chữ ký, mở đăng nhập GitHub, tạo tunnel cố định rồi khởi động lại UmiBridge dưới nền. Không cần mua tên miền. Các lần sau vẫn dùng `Start-UmiBridge.cmd`. Quick Tunnel vẫn có thể dùng để thử kết nối tạm.

Lấy URL `/mcp` tại dashboard và mã kết nối trong `.local-data/CONNECT.txt`. Khi trình duyệt hiện trang thông báo truy cập lần đầu của Microsoft, bạn tự xem và xác nhận trước khi vào OAuth. Nếu đã có app dùng link tạm cũ, tạo kết nối mới với URL cố định; nút “Kết nối lại” không tự thay URL đã lưu.

1. Mở ChatGPT và khu vực thêm **MCP server tùy chỉnh**. Tên menu có thể đổi tùy gói/phiên bản.
2. Nhập tên hiển thị **UmiBridge** (hoặc đặt tên tùy ý).
3. Dán nguyên **Server URL** kết thúc bằng `/mcp` từ dashboard hoặc cửa sổ UmiBridge. Sau thiết lập cố định, địa chỉ dùng `devtunnels.ms`; chế độ tạm dùng `trycloudflare.com`.
4. Chọn `OAuth`. Phần đăng ký client sử dụng `Dynamic Client Registration (DCR)`; không tự nhập Client ID hoặc Secret.
5. Nếu có các scope, bật `desktop` và `offline_access`.
6. Theo luồng consent trong trình duyệt, nhập **mã kết nối trên trang cấp quyền UmiBridge**. Lấy mã từ `.local-data/CONNECT.txt` hoặc cửa sổ `Start-ChatGPT.cmd` đang hiển thị. Dashboard chỉ hiện endpoint, không hiện mã.
7. Khi xác thực thành công, mở chat mới, chọn kết nối UmiBridge và thử một hành động đọc file không nhạy cảm.

**Mã kết nối không phải API key của ChatGPT.** Không gửi mã này qua tin nhắn hoặc công bố ảnh chụp màn hình chứa mã.

**Quick Tunnel** tạo URL HTTPS tạm. Sau khi dừng/chạy lại, cần xem `Server URL` mới và cập nhật plugin nếu URL đổi.

**Tunnel cố định:** giữ nguyên URL khi dùng lại cùng tunnel. OAuth được lưu tại máy và ràng buộc với URL đó, nên không mất chỉ vì khởi động lại. Access token vẫn hết hạn sau 15 phút; ChatGPT dùng refresh token để tự làm mới, kể cả khi chỉ yêu cầu scope `desktop`. Refresh token có hạn 30 ngày và được xoay sau mỗi lần dùng. Việc thu hồi quyền cũng được lưu. Request cấp quyền đang dở và mã xác thực dùng một lần không tồn tại qua lần khởi động lại.

Dev Tunnels là dịch vụ public preview. Microsoft xóa tunnel sau 30 ngày không hoạt động; nếu đăng nhập hosting hết hạn, chạy lại `Setup-Stable-Connection.cmd` để đăng nhập và dùng lại tunnel. Chi tiết: [CLI Microsoft](https://learn.microsoft.com/en-us/azure/developer/dev-tunnels/cli-commands), [FAQ](https://learn.microsoft.com/en-us/azure/developer/dev-tunnels/faq).

Tên menu và quyền thêm ứng dụng phụ thuộc phiên bản/tài khoản. Có thể đối chiếu với [hướng dẫn MCP chính thức của OpenAI](https://developers.openai.com/api/docs/guides/custom-mcp-server).

## 3. Kết nối Gemini web bằng ứng dụng MCP tùy chỉnh

Nếu ChatGPT đang dùng tunnel cố định, **dùng lại đúng URL đó cho Gemini qua OAuth**. Chế độ ghép nối tùy chọn bên dưới dùng đường dẫn riêng trên cùng tunnel. Không cần chạy server thứ hai, tạo tunnel khác hay đăng ký Gemini API.

1. Nhấp đúp **`Setup-Gemini.cmd`** trong thư mục UmiBridge. Script kiểm tra dependency, khởi động hoặc dùng lại server đang chạy dưới nền, sao chép URL kết nối hiện tại vào clipboard và mở [cài đặt ứng dụng Gemini bằng tiếng Anh](https://gemini.google.com/customize/connectors?hl=en). Script dùng OAuth `/mcp` nếu chưa cấu hình ghép nối riêng.
2. Tìm **Custom apps → Add a custom app**. Trên giao diện tiếng Việt có thể thấy **Tùy chỉnh → Tạo ứng dụng tùy chỉnh**.
3. Dán URL vừa sao chép, nhấn **Tiếp theo / Next**. UmiBridge hỗ trợ đăng ký client tự động (DCR), nên không cần tự điền Client ID hoặc Client Secret trong mục nâng cao.
4. Với OAuth, làm theo màn hình liên kết tài khoản Google và cấp quyền. Nếu trang UmiBridge yêu cầu mã kết nối, lấy mã trong `.local-data/CONNECT.txt` hoặc cửa sổ `Start-ChatGPT.cmd` đang hiển thị rồi nhập trên chính trang đó. Dashboard chỉ hiện endpoint, không hiện mã. Không dán mã vào cuộc trò chuyện.
5. Quay lại một chat hoặc tác vụ Gemini, gõ `@` và chọn ứng dụng UmiBridge vừa kết nối. Thử đọc một file không nhạy cảm trong dự án trước.
6. Khi Gemini chuẩn bị ghi file hoặc chạy lệnh, xem nội dung và xác nhận nếu đúng yêu cầu. Google hiện yêu cầu xác nhận thủ công với các thao tác ghi dữ liệu.

**Điều kiện tài khoản:** tài liệu Google hiện nêu tài khoản cá nhân, từ 18 tuổi, ở Mỹ, tiếng Anh và bật **Keep Activity**. Việc mở tính năng và ngôn ngữ giao diện có thể khác nhau giữa các tài khoản; một số tài khoản có nút tạo ứng dụng bằng tiếng Việt. Hãy kiểm tra trực tiếp mục **Custom apps / Tùy chỉnh** của bạn. UmiBridge không thể bật tính năng chưa được Google cấp cho tài khoản. Xem [hướng dẫn Custom Apps hiện tại của Google](https://support.google.com/gemini/answer/17209137).

Đây là kết nối ngay trên `gemini.google.com`; **không cần Gemini CLI, API key hay tiện ích trình duyệt**. Sau khi kết nối xong, các lần chạy hằng ngày vẫn dùng `Start-UmiBridge.cmd` cho cả ChatGPT và Gemini.

### Tùy chọn khi cửa sổ OAuth của Google bị trắng

Nhấp đúp **`Setup-Gemini-Paired.cmd`** để tạo URL ghép nối riêng. Script tạo secret ngẫu nhiên 32 byte trong thư mục được bảo vệ `.local-data/gemini-pairing-secret.txt`, khởi động lại riêng UmiBridge và giữ các quyền OAuth đã cấp. URL đầy đủ được ghi vào `.local-data/GEMINI-CONNECT.txt`, sao chép vào clipboard và trang cài đặt Gemini được mở bằng tiếng Anh.

Dán URL này **chỉ vào ô MCP Server URL** khi tạo ứng dụng Gemini. Vẫn xem và xác nhận cảnh báo ứng dụng tùy chỉnh. Đường dẫn `/gemini/<random>/mcp` dùng chính URL để xác thực, không đi qua luồng liên kết tài khoản OAuth riêng. Sau khi cấu hình, `Setup-Gemini.cmd` sẽ tự dùng lại URL ghép nối.

**Coi toàn bộ URL như mật khẩu:** ai có URL đầy đủ có thể gọi các công cụ được mở. Nó không có chu kỳ hết hạn/làm mới OAuth hay quyền riêng theo từng client; URL dùng lại được đến khi thu hồi. Không dán vào chat, ảnh chụp hay Git. Để thu hồi, xóa `.local-data/gemini-pairing-secret.txt`, chạy `Stop-ChatGPT.cmd` rồi `Start-UmiBridge.cmd`. Sau đó có thể kết nối Gemini lại bằng OAuth thông thường. Đường dẫn `/mcp` thông thường vẫn yêu cầu OAuth.

**Giới hạn beta của Gemini:** có thể thêm app và đồng bộ đủ 11 công cụ nhưng lần thực thi vẫn lỗi trong Gemini. Kiểm tra thực tế đã thấy một lệnh đọc thành công ở backend; lần thử Task sau đó báo không tìm thấy transport của môi trường production trong cấu hình connector. Chưa xác nhận được đầy đủ chuỗi ghi file và PowerShell từ Gemini trên tài khoản kiểm tra. Kết quả test local hoặc nhãn app đã kết nối không thay thế được kiểm tra toàn bộ luồng. Chưa xác định được bản sửa phía UmiBridge cho thông báo này.

## 4. Dashboard Sakura Console

**Ngôn ngữ:** Giao diện mặc định là **English** cho người dùng quốc tế. Chọn **Tiếng Việt** trên thanh điều hướng ở góc phải để chuyển ngôn ngữ, hoặc chọn **English** để quay lại. Tùy chọn được lưu trên trình duyệt và không thay đổi dữ liệu request hoặc skill.


Địa chỉ: **http://127.0.0.1:43127/admin**, chỉ mở **trên máy đang chạy UmiBridge**.

| Trang | Nội dung |
|---|---|
| Tổng quan | Trạng thái, tổng request, thành công/lỗi, 24 giờ, độ trễ trung bình và P95 |
| Phân tích | Biểu đồ 12 giờ, công cụ được gọi nhiều |
| Chat liên kết | Cuộc trò chuyện ChatGPT hoặc Gemini đã gắn với request |
| Skill Center | Các skill Codex/Agents cài trên máy, bật/tắt, xem nội dung, thêm/bỏ gắn |
| Lịch sử request | Tìm kiếm, bộ lọc, thời gian, công cụ, kết quả, tham số đã rút gọn |

Có thể bật/tắt Dark Mode bằng biểu tượng góc trên phải và bật **Tự cập nhật** (mỗi 20 giây).

### Link và ID cuộc trò chuyện

Lịch sử hiển thị nhãn ứng dụng/nhà cung cấp khi nhận diện được client. Nhãn này **không cho biết request thuộc cuộc trò chuyện nào**; giao thức MCP không tự gửi ID chat hoặc đường dẫn chat. Để liên kết thủ công:

1. Sao chép URL cuộc trò chuyện hoặc link chia sẻ của ChatGPT hay Gemini.
2. Mở **Lịch sử request**, tìm đúng request (thời gian/công cụ).
3. Nhấn **Chi tiết / Chat**, dán URL. Các dạng được hỗ trợ gồm `https://chatgpt.com/c/...`, `https://chatgpt.com/share/...`, `https://gemini.google.com/app/...`, `https://gemini.google.com/share/...` và link ngắn Gemini sao chép ra `https://g.co/gemini/share/...`.
4. Nhấn **Lưu liên kết**. UmiBridge sẽ tách Chat ID từ URL và lưu ở máy này.
5. Dùng **Mở chat** để trở về đúng dịch vụ.

Nếu gắn nhầm, chọn **Bỏ gắn**; không có chức năng tự nhận diện chat nào tạo request nào.

## 5. Skill Center - dùng skill cũ và tự thêm skill

UmiBridge **không sao chép skill riêng tư của bạn lên GitHub**. Khi khởi động, nó tìm `SKILL.md` từ:

- `%USERPROFILE%\.codex\skills\<tên-skill>\SKILL.md`
- `%USERPROFILE%\.agents\skills\<tên-skill>\SKILL.md`
- `.agents\skills\<tên-skill>\SKILL.md` bên trong repository, nếu có
- Thư mục thêm thủ công mà bạn tự chỉ định

Bảy skill được ưu tiên: `ui-ux-pro-max`, `impeccable`, `frontend-checklist-global`, `playwright-cli`, `ponytail`, `api-security-testing`, `find-security-vulnerabilities-in-code`.

**Các skill ưu tiên tự bật nếu tìm thấy `SKILL.md` hợp lệ.** Skill khác phát hiện được để ở trạng thái tắt mặc định để tránh đọc nhầm tài liệu chưa kiểm tra.

### Dùng skill với ChatGPT hoặc Gemini

Trong chat, có thể viết:

> "Dùng UmiBridge `list_skills` để liệt kê skill trên máy, sau đó gọi `read_skill` cho `ui-ux-pro-max` và áp dụng nguyên tắc của skill để thiết kế lại UI trang chủ dự án."

`list_skills` trả tên/mô tả/trạng thái (không gửi đường dẫn tuyệt đối). `read_skill` trả nội dung file `SKILL.md` **chỉ của skill đang bật**. Script trong skill không tự chạy; nếu cần chạy, trợ lý phải thao tác riêng và người dùng cần kiểm tra mức độ tin cậy.

### Thêm skill tùy ý

1. Cài hoặc sao chép skill hợp pháp từ một nguồn tin tưởng vào thư mục riêng. Thư mục phải có file `SKILL.md`.
2. Mở `/admin → Skill Center`.
3. Dán đường dẫn tuyệt đối tới **thư mục chứa file**, ví dụ `D:\MySkills\my-new-skill`.
4. Nhấn **Thêm skill** và kiểm tra mục vừa xuất hiện.
5. Nhấn **Xem hướng dẫn** để đọc, dùng **Bật/Tắt** để quản lý.
6. **Bỏ gắn** chỉ xóa liên kết khỏi UmiBridge, **không xóa file nguồn**.

Không tự động cài skill từ GitHub URL, không tự tải dependency và không chạy code của skill. Nếu muốn sử dụng scripts đi kèm, hãy đánh giá nội dung thủ công trước.

Cấu hình nằm trong `.local-data/skill-registry.json`, không được commit.

## 6. Dừng và khởi động lại an toàn

1. Đóng các tác vụ file đang chạy dở.
2. Nhấp đúp `Stop-ChatGPT.cmd`. Chờ `UmiBridge stopped`.
3. Nhấp đúp `Start-UmiBridge.cmd`.
4. Mở lại `127.0.0.1:43127/admin`. Nếu trình duyệt giữ giao diện cũ, nhấn `Ctrl + Shift + R`.
5. Nếu URL tunnel đổi, cập nhật kết nối bên ChatGPT và Gemini. Tunnel cố định giúp tránh đổi URL sau mỗi lần chạy.

Script Stop kiểm tra PID lưu trong trạng thái local cùng tiến trình Node và cổng loopback. Tránh tắt hàng loạt tiến trình Node bằng `taskkill /IM node.exe /F`.

## 7. Các lỗi thường gặp

**`node is not recognized` / `npm is not recognized`:** Nhấp đúp `Install-UmiBridge.cmd` lại khi có Internet. Bộ cài sẽ tự thêm Node.js portable vào `.runtime/`; không cần sửa PATH hệ thống.

**`EADDRINUSE` hoặc named pipe đã có phiên giữ:** Một phiên UmiBridge đã chạy. Sử dụng `Stop-ChatGPT.cmd`, không chạy đè hai cửa sổ Start. Nếu Stop không dừng được, kiểm tra PID và đảm bảo đó là phiên của chính project trước khi dừng thủ công.

**Setup không tải được cloudflared:** Kiểm tra firewall/proxy/Internet, có thể thử kết nối lại và chạy lại Setup. Không tải file .exe từ nguồn không rõ.

**Chạy nền không thành công:** Mở `.local-data/server-error.log` để xem lỗi. Có thể chạy `Start-ChatGPT.cmd` một lần để xem trực tiếp thông báo khởi động.

**Không thấy dashboard:** Kiểm tra terminal UmiBridge có đang chạy không; URL phải là `http://127.0.0.1:43127/admin` trên đúng máy. Nếu sử dụng cổng `DC_WEB_PORT` khác, thay bằng cổng bạn đã chọn.

**ChatGPT bị 401/không kết nối:** Kiểm tra URL HTTPS có `/mcp`, DCR, OAuth và scopes; URL Quick Tunnel cũ không còn hợp lệ khi restart.

**Gemini không có mục Tùy chỉnh / Custom apps:** Kiểm tra điều kiện và tình trạng mở tính năng theo tài khoản trong tài liệu Google ở mục 3. Không đổi cấu hình máy hoặc mua API key để tìm cách bật menu này.

**Gemini không kết nối được:** Chạy lại `Setup-Gemini.cmd` để sao chép đúng URL đang hoạt động, hoàn tất luồng kết nối đã chọn và giữ UmiBridge chạy. Nếu Gemini yêu cầu bạn xác nhận thao tác ghi, cần xem và xác nhận trước khi tiếp tục.

**Cửa sổ OAuth Google chỉ hiện trang trắng:** Có thể thử `Setup-Gemini-Paired.cmd` theo mục 3. URL ghép nối là thông tin cấp quyền, cần giữ kín.

**Không thấy skill đã cài:** Kiểm tra tên thư mục, file `SKILL.md` có thật, không phải symlink và không vượt 128 KiB. Nếu skill nằm ngoài thư mục Codex chuẩn, thêm bằng đường dẫn tuyệt đối trong Skill Center. Nếu vừa cài, nhấn làm mới trang admin.

**Skill đọc bị lỗi "đang tắt":** Vào Skill Center → **Bật** rồi yêu cầu ChatGPT gọi `read_skill` lại.

**Dữ liệu dashboard bị rỗng:** History chỉ lưu request qua UmiBridge, tối đa 500 bản ghi. Các request ngoài tool hoặc từ hệ thống khác sẽ không xuất hiện.

## 8. Dữ liệu riêng tư và vận hành trên máy khác

| Đường dẫn | Loại dữ liệu | Có push GitHub? |
|---|---|---|
| `.local-data/connection-secret.txt` | Mã kết nối | Không |
| `.local-data/CONNECT.txt` | Hướng dẫn và mã kết nối local | Không |
| `.local-data/gemini-pairing-secret.txt` | Secret ghép nối Gemini tùy chọn | Không |
| `.local-data/GEMINI-CONNECT.txt` | URL đầy đủ có quyền gọi công cụ | Không |
| `.local-data/oauth-state.json` | OAuth clients và quyền đã cấp | Không |
| `.local-data/tunnel-config.json` | Cấu hình tunnel riêng của máy | Không |
| `.local-data/web-status.json` | PID và URL tunnel | Không |
| `.local-data/request-history.jsonl` | Lịch sử đã rút gọn | Không |
| `.local-data/chat-links.json` | Link/ID chat gắn thủ công | Không |
| `.local-data/skill-registry.json` | Path + trạng thái skill | Không |
| `local-bin/` | Binary Cloudflare tải về | Không |
| `.runtime/` | Node.js portable của riêng dự án | Không |
| `node_modules/` | Dependency local | Không |

Chỉ source và hướng dẫn được đưa lên GitHub. **Không mang `.local-data/` khi chuyển máy** vì có thông tin kết nối và lịch sử riêng của máy cũ. Không đưa profile trình duyệt, thông tin tài khoản, mã kết nối, URL tunnel cá nhân hay log runtime vào gói source. Thực hiện Install và OAuth mới trên máy thứ hai.

Lịch sử `run_command` hiển thị ngay trong `/admin`: câu lệnh, thư mục chạy, exit code, stdout và stderr giới hạn. Bộ lọc chỉ che những secret và đường dẫn phổ biến; không thể bảo đảm xóa sạch mọi bí mật trong chuỗi tùy ý. Tránh chạy câu lệnh chứa mật khẩu/token, không đăng log debug chứa đường dẫn cá nhân công khai.

## 9. Phát triển và kiểm thử

~~~powershell
npm ci --ignore-scripts --no-audit --no-fund
npm run build
npm run local:test
~~~

Mã nguồn: `scripts/chatgpt-backend.mjs` (9 công cụ file/terminal + 2 công cụ skill), `scripts/skill-library.mjs`, `scripts/local-web-gateway.mjs`, `scripts/local-admin.mjs` và `scripts/admin-dashboard.html`.

Gói phát hành beta trên GitHub là **source ZIP có bộ cài bootstrap một lần**, chưa phải MSI. Mỗi máy mới chạy `Install-UmiBridge.cmd`, thiết lập tunnel cố định được khuyến nghị rồi kết nối tài khoản ChatGPT hoặc chạy `Setup-Gemini.cmd` để kết nối Gemini.

---

*UmiBridge ✿ Sakura Console - công cụ cá nhân hóa, quản trị trên máy của bạn.*
