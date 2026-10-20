<div align="center">

<img src="assets/umibridge-banner.svg" alt="UmiBridge Sakura Console: personal Windows MCP bridge for ChatGPT" width="100%">

# UmiBridge · Sakura Console

**Your PC. Your skills. Your command center.**

A personal Windows MCP bridge connecting ChatGPT to your files and PowerShell, with a private anime-inspired dashboard and an optional local Codex Skill Center.

**[English](#english) · [Tiếng Việt](#tieng-viet) · [Releases](https://github.com/TDUmii/umi-bridge/releases) · [Vietnamese user manual](LOCAL-README.vi.md)**

</div>

---

<a id="english"></a>

## English

> [!WARNING]
> **Beta software — powerful local access.** After you authorize the MCP connection, ChatGPT can read and modify local files and run PowerShell commands on your computer. Use a trusted ChatGPT account, verify actions before allowing them, and back up important files. Never disclose your connection code, credentials, tokens, or private local logs.

### What is UmiBridge?

UmiBridge runs an MCP server on your Windows computer and exposes its connection to ChatGPT through OAuth and a temporary HTTPS Cloudflare Quick Tunnel. Its **Sakura Console** dashboard is available *only on the local computer*.

| Feature | What you get |
| --- | --- |
| Local file tools | Read, write, edit, move, search, inspect, and create files or directories |
| Shell tools | Execute PowerShell commands and retrieve bounded output |
| MCP authorization | OAuth, PKCE, Dynamic Client Registration (DCR), scoped tokens |
| Sakura Console | English-by-default admin UI, optional Vietnamese switch, light/dark themes |
| Analytics | Request history, tool usage, outcome counts, average/P95 latency and a 12-hour activity chart |
| Chat associations | Manually attach a ChatGPT conversation link to a request |
| Skill Center | Discover installed Codex/Agents skills, preview SKILL.md, enable/disable them, and add custom skill folders |

**Important:** UmiBridge does not receive ChatGPT conversation IDs through MCP. Chat associations must be created manually. Enabling a skill does not execute its scripts.

### Requirements

- **Windows 10 or Windows 11 (x64)** and an internet connection.
- Node.js 22.12.0 or newer is optional. The one-click installer downloads the latest official Windows x64 LTS runtime when a compatible Node.js is not already available.
- A ChatGPT account with access to **custom MCP connectors and OAuth**, depending on current product availability.

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

### Connect to ChatGPT

1. In ChatGPT, open **Settings → Plugins/Apps / custom MCP connectors** (actual wording may vary by plan and release).
2. Add a new custom MCP server, optionally naming it **UmiBridge**.
3. Copy the exact HTTPS **Server URL** ending in `/mcp` from the UmiBridge terminal.
4. Select **OAuth** with **Dynamic Client Registration (DCR)**. Leave Client ID / Client Secret blank if registration is automatic.
5. Select the `desktop` and `offline_access` scopes if the interface offers them.
6. Follow the consent flow and enter the connection code on UmiBridge's authorization page — **not inside the ChatGPT conversation**.
7. Test the connection by asking ChatGPT to **read a non-sensitive file**.

Quick Tunnel URLs can change after every restart. If ChatGPT loses the connection, update the server URL or reconnect using the newly displayed URL.

### Sakura Console — languages, analytics and chat links

On the same Windows computer, open **http://127.0.0.1:43127/admin**. The dashboard cannot be opened through the public tunnel.

The interface **defaults to English**. Use the **English / Tiếng Việt** language selector in the top bar to switch instantly. Your selection is saved in this browser, and the language changes independently of the light/dark theme.

From the sidebar, you can browse Overview, Analytics, Linked chats, Skill Center and Request history. Search and filter requests, inspect redacted arguments and copy your connection endpoint. Auto-refresh runs every 20 seconds when enabled.

To associate a chat: open **Request history → Details / Chat**, paste the known ChatGPT conversation URL (for example, `https://chatgpt.com/c/...`), then choose **Save link**. The conversation ID is extracted only from the URL that *you* supplied. You can unlink it at any time.

### Skill Center — built in, expandable and local

Skills are detected from the current machine's common directories:

- `%USERPROFILE%\.codex\skills`
- `%USERPROFILE%\.agents\skills`
- `.agents/skills` inside the project directory
- Any absolute local skill folder you explicitly add from the dashboard

UmiBridge recognizes these **seven suggested skill names** when installed: `ui-ux-pro-max`, `impeccable`, `frontend-checklist-global`, `playwright-cli`, `ponytail`, `api-security-testing`, and `find-security-vulnerabilities-in-code`. Recommended skills default to enabled when discovered; other skills default to disabled until you enable them.

To add your own skill, create/download a trusted folder containing `SKILL.md`, open **Skill Center**, enter its absolute folder path and select **Add skill**. You can preview, enable/disable, or unlink it without deleting the original source.

Through MCP, ChatGPT can use `list_skills` and `read_skill` to list and read the instructions of enabled skills. **Scripts do not execute automatically.** Skill instructions are untrusted content; review them before asking ChatGPT to run commands. Do not store secrets inside SKILL.md.

### Stop, restart and troubleshoot

To restart, run `Stop-ChatGPT.cmd`, wait for the stop confirmation, then run `Start-UmiBridge.cmd` again. Use `Start-ChatGPT.cmd` when you need to see the connection URL and startup diagnostics. Refresh the dashboard with **Ctrl + Shift + R** if you still see an older version.

| Symptom | What to do |
| --- | --- |
| `EADDRINUSE` or an occupied named pipe | Run `Stop-ChatGPT.cmd` before restarting; do not kill every `node.exe` |
| `node` / `npm` command not found | Double-click `Install-UmiBridge.cmd` again with internet access; it installs a project-local Node.js runtime automatically |
| `cloudflared.exe` is missing | Rerun `Setup-Local.ps1` with internet access |
| Background start fails | Read `.local-data/server-error.log`, then run `Start-ChatGPT.cmd` once to see the startup error |
| Dashboard will not load | Confirm the launcher is running and open the loopback URL on the host computer |
| ChatGPT reports a 401 or connection failure | Verify the current `/mcp` URL, OAuth scopes and registration; reconnect after tunnel restarts |
| Skill does not appear | Check the directory contains a regular `SKILL.md` file no larger than 128 KiB; add it manually if outside the standard folders |
| The UI is not in English | Select **English** in the top bar; the default applies until a browser-specific preference is saved |

### Privacy and security

- The admin dashboard is **loopback-only**. The public HTTPS tunnel exposes the OAuth-protected MCP service, **not** your dashboard.
- Runtime credentials, OAuth state, request history, chat associations and skill preferences are stored under `.local-data/`, which is excluded from version control.
- `.runtime/`, `node_modules/` and the downloaded `local-bin/` are also ignored and excluded from source releases.
- Recorded request arguments use **best-effort redaction**, not guaranteed removal of arbitrary secrets embedded inside commands or strings. Avoid sending secrets inside tool inputs.
- `run_command` history stores the command, working directory, exit code and bounded `stdout`/`stderr` locally so you can inspect it in `/admin`; output is capped and receives basic secret/path redaction.
- History is bounded to 500 stored entries, and the dashboard lists recent requests; it is **not a ChatGPT conversation archive**.
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

# Tiếng Việt — Hướng dẫn UmiBridge ✿ Sakura Console

**Phiên bản:** v0.1.0-beta.3 (thử nghiệm). **Hệ điều hành:** Windows 10/11 x64.
**Repository:** https://github.com/TDUmii/umi-bridge  
**Điều khiển:** ChatGPT web (MCP + OAuth). **Quản trị:** http://127.0.0.1:43127/admin

> [!WARNING]
> Dự án cho phép ChatGPT thao tác với file và thực thi PowerShell trên máy đã xác thực. Chỉ cấp quyền cho tài khoản ChatGPT bạn tin cậy. Nên sao lưu dữ liệu quan trọng, không tiết lộ mã kết nối và chỉ chạy lệnh mà bạn đã hiểu rõ.

## 1. Cài lần đầu trên một máy Windows khác

### Chuẩn bị

- Windows 10/11 x64, Internet.
- Có Internet để chạy bộ cài một lần. Node.js **22.12.0+** là tùy chọn; nếu máy chưa có bản phù hợp, `Install-UmiBridge.cmd` sẽ tự tải bản LTS Windows x64 chính thức vào thư mục dự án.

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

### Thiết lập thủ công nâng cao

Mở PowerShell tại thư mục chứa `Setup-Local.ps1`, chạy:

~~~powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Setup-Local.ps1
~~~

Script thực hiện các bước giống bộ cài một lần nhưng không tự mở server.

Sau khi cài sẽ xuất hiện `.runtime/`, `node_modules/` và `local-bin/` trên máy. Các thư mục này không được đưa lên GitHub.

### Chạy

Lần đầu bộ cài sẽ mở `Start-ChatGPT.cmd`. Chờ thông báo `Server URL`, `Authentication: OAuth` và mã kết nối để kết nối ChatGPT. Sau khi OAuth hoàn tất, dùng `Start-UmiBridge.cmd` để server chạy ẩn và dashboard tự mở, không che màn hình.

## 2. Kết nối ChatGPT bằng OAuth

1. Mở ChatGPT và khu vực thêm **MCP server tùy chỉnh**. Tên menu có thể đổi tùy gói/phiên bản.
2. Nhập tên hiển thị **UmiBridge** (hoặc đặt tên tùy ý).
3. Dán nguyên **Server URL** dạng `https://...trycloudflare.com/mcp` từ cửa sổ chạy `Start-ChatGPT.cmd`.
4. Chọn `OAuth`. Phần đăng ký client sử dụng `Dynamic Client Registration (DCR)`; không tự nhập Client ID hoặc Secret.
5. Nếu có các scope, bật `desktop` và `offline_access`.
6. Theo luồng consent trong trình duyệt, nhập **mã kết nối ở cửa sổ terminal UmiBridge**.
7. Khi xác thực thành công, mở chat mới, chọn kết nối UmiBridge và thử một hành động đọc file không nhạy cảm.

**Mã kết nối không phải API key của ChatGPT.** Không gửi mã này qua tin nhắn hoặc công bố ảnh chụp màn hình chứa mã.

**Quick Tunnel** tạo URL HTTPS tạm. Sau khi dừng/chạy lại, cần xem `Server URL` mới và cập nhật plugin nếu URL đổi.

## 3. Dashboard Sakura Console

Mặc định giao diện là **English**. Chọn **Tiếng Việt** ở góc phải thanh trên để chuyển ngôn ngữ. Lựa chọn được ghi nhớ trong trình duyệt này.

Địa chỉ: **http://127.0.0.1:43127/admin**, chỉ mở **trên máy đang chạy UmiBridge**.

| Trang | Nội dung |
|---|---|
| Tổng quan | Trạng thái, tổng request, thành công/lỗi, 24 giờ, độ trễ trung bình và P95 |
| Phân tích | Biểu đồ 12 giờ, công cụ được gọi nhiều |
| Chat liên kết | Cuộc trò chuyện ChatGPT đã gắn với request |
| Skill Center | Các skill Codex/Agents cài trên máy, bật/tắt, xem nội dung, thêm/bỏ gắn |
| Lịch sử request | Tìm kiếm, bộ lọc, thời gian, công cụ, kết quả, tham số đã rút gọn |

Có thể bật/tắt Dark Mode bằng biểu tượng góc trên phải và bật **Tự cập nhật** (mỗi 20 giây).

### Link và ID cuộc trò chuyện

Giao thức MCP **không tự gửi ID chat hoặc đường dẫn chat**. Để liên kết thủ công:

1. Sao chép URL cuộc trò chuyện ChatGPT.
2. Mở **Lịch sử request**, tìm đúng request (thời gian/công cụ).
3. Nhấn **Chi tiết / Chat**, dán URL `https://chatgpt.com/c/...`.
4. Nhấn **Lưu liên kết**. UmiBridge sẽ tách Chat ID từ URL và lưu ở máy này.
5. Dùng **Mở chat** để trở về ChatGPT.

Nếu gắn nhầm, chọn **Bỏ gắn**; không có chức năng tự nhận diện chat nào tạo request nào.

## 4. Skill Center — dùng skill cũ và tự thêm skill

UmiBridge **không sao chép skill riêng tư của bạn lên GitHub**. Khi khởi động, nó tìm `SKILL.md` từ:

- `%USERPROFILE%\.codex\skills\<tên-skill>\SKILL.md`
- `%USERPROFILE%\.agents\skills\<tên-skill>\SKILL.md`
- `.agents\skills\<tên-skill>\SKILL.md` bên trong repository, nếu có
- Thư mục thêm thủ công mà bạn tự chỉ định

Bảy skill được ưu tiên: `ui-ux-pro-max`, `impeccable`, `frontend-checklist-global`, `playwright-cli`, `ponytail`, `api-security-testing`, `find-security-vulnerabilities-in-code`.

**Các skill ưu tiên tự bật nếu tìm thấy `SKILL.md` hợp lệ.** Skill khác phát hiện được để ở trạng thái tắt mặc định để tránh đọc nhầm tài liệu chưa kiểm tra.

### Dùng skill với ChatGPT

Trong chat, có thể viết:

> "Dùng UmiBridge `list_skills` để liệt kê skill trên máy, sau đó gọi `read_skill` cho `ui-ux-pro-max` và áp dụng nguyên tắc của skill để thiết kế lại UI trang chủ dự án."

`list_skills` trả tên/mô tả/trạng thái (không gửi đường dẫn tuyệt đối). `read_skill` trả nội dung file `SKILL.md` **chỉ của skill đang bật**. Script trong skill không tự chạy; nếu cần chạy, ChatGPT phải thao tác riêng và người dùng cần kiểm tra mức độ tin cậy.

### Thêm skill tùy ý

1. Cài hoặc sao chép skill hợp pháp từ một nguồn tin tưởng vào thư mục riêng. Thư mục phải có file `SKILL.md`.
2. Mở `/admin → Skill Center`.
3. Dán đường dẫn tuyệt đối tới **thư mục chứa file**, ví dụ `D:\MySkills\my-new-skill`.
4. Nhấn **Thêm skill** và kiểm tra mục vừa xuất hiện.
5. Nhấn **Xem hướng dẫn** để đọc, dùng **Bật/Tắt** để quản lý.
6. **Bỏ gắn** chỉ xóa liên kết khỏi UmiBridge, **không xóa file nguồn**.

Không tự động cài skill từ GitHub URL, không tự tải dependency và không chạy code của skill. Nếu muốn sử dụng scripts đi kèm, hãy đánh giá nội dung thủ công trước.

Cấu hình nằm trong `.local-data/skill-registry.json`, không được commit.

## 5. Dừng và khởi động lại an toàn

1. Đóng các tác vụ file đang chạy dở.
2. Nhấp đúp `Stop-ChatGPT.cmd`. Chờ `UmiBridge stopped`.
3. Nhấp đúp `Start-UmiBridge.cmd`.
4. Mở lại `127.0.0.1:43127/admin`. Nếu trình duyệt giữ giao diện cũ, nhấn `Ctrl + Shift + R`.
5. Nếu URL tunnel đổi, cập nhật kết nối bên ChatGPT.

Script Stop kiểm tra PID lưu trong trạng thái local cùng tiến trình Node và cổng loopback. Tránh tắt hàng loạt tiến trình Node bằng `taskkill /IM node.exe /F`.

## 6. Các lỗi thường gặp

**`node is not recognized` / `npm is not recognized`:** Nhấp đúp `Install-UmiBridge.cmd` lại khi có Internet. Bộ cài sẽ tự thêm Node.js portable vào `.runtime/`; không cần sửa PATH hệ thống.

**`EADDRINUSE` hoặc named pipe đã có phiên giữ:** Một phiên UmiBridge đã chạy. Sử dụng `Stop-ChatGPT.cmd`, không chạy đè hai cửa sổ Start. Nếu Stop không dừng được, kiểm tra PID và đảm bảo đó là phiên của chính project trước khi dừng thủ công.

**Setup không tải được cloudflared:** Kiểm tra firewall/proxy/Internet, có thể thử kết nối lại và chạy lại Setup. Không tải file .exe từ nguồn không rõ.

**Không thấy dashboard:** Kiểm tra terminal UmiBridge có đang chạy không; URL phải là `http://127.0.0.1:43127/admin` trên đúng máy. Nếu sử dụng cổng `DC_WEB_PORT` khác, thay bằng cổng bạn đã chọn.

**ChatGPT bị 401/không kết nối:** Kiểm tra URL HTTPS có `/mcp`, DCR, OAuth và scopes; URL Quick Tunnel cũ không còn hợp lệ khi restart.

**Không thấy skill đã cài:** Kiểm tra tên thư mục, file `SKILL.md` có thật, không phải symlink và không vượt 128 KiB. Nếu skill nằm ngoài thư mục Codex chuẩn, thêm bằng đường dẫn tuyệt đối trong Skill Center. Nếu vừa cài, nhấn làm mới trang admin.

**Skill đọc bị lỗi "đang tắt":** Vào Skill Center → **Bật** rồi yêu cầu ChatGPT gọi `read_skill` lại.

**Dữ liệu dashboard bị rỗng:** History chỉ lưu request qua UmiBridge, tối đa 500 bản ghi. Các request ngoài tool hoặc từ hệ thống khác sẽ không xuất hiện.

## 7. Dữ liệu riêng tư và vận hành trên máy khác

| Đường dẫn | Loại dữ liệu | Có push GitHub? |
|---|---|---|
| `.local-data/connection-secret.txt` | Mã kết nối | Không |
| `.local-data/web-status.json` | PID và URL tunnel | Không |
| `.local-data/request-history.jsonl` | Lịch sử đã rút gọn | Không |
| `.local-data/chat-links.json` | Link/ID chat gắn thủ công | Không |
| `.local-data/skill-registry.json` | Path + trạng thái skill | Không |
| `local-bin/` | Binary Cloudflare tải về | Không |
| `.runtime/` | Node.js portable của riêng dự án | Không |
| `node_modules/` | Dependency local | Không |

Chỉ source và hướng dẫn được đưa lên GitHub. **Không mang `.local-data/` khi chuyển máy** vì có thông tin kết nối và lịch sử riêng của máy cũ. Thực hiện Install và OAuth mới trên máy thứ hai.

Lịch sử `run_command` hiển thị ngay trong `/admin`: câu lệnh, thư mục chạy, exit code, stdout và stderr giới hạn. Bộ lọc chỉ che những secret và đường dẫn phổ biến; không thể bảo đảm xóa sạch mọi bí mật trong chuỗi tùy ý. Tránh chạy câu lệnh chứa mật khẩu/token, không đăng log debug chứa đường dẫn cá nhân công khai.

## 8. Phát triển và kiểm thử

~~~powershell
npm ci --ignore-scripts --no-audit --no-fund
npm run build
npm run local:test
~~~

Mã nguồn: `scripts/chatgpt-backend.mjs` (9 công cụ file/terminal + 2 công cụ skill), `scripts/skill-library.mjs`, `scripts/local-web-gateway.mjs`, `scripts/local-admin.mjs` và `scripts/admin-dashboard.html`.

Gói phát hành beta trên GitHub là **source ZIP có bộ cài bootstrap một lần**, chưa phải MSI. Mọi máy mới chỉ cần nhấp đúp `Install-UmiBridge.cmd` rồi làm theo cửa sổ OAuth của ChatGPT.

---

*UmiBridge ✿ Sakura Console — công cụ cá nhân hóa, dữ liệu nằm trên máy của bạn.*

