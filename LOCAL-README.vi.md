# UmiBridge ✿ Sakura Console — Hướng dẫn sử dụng chi tiết

**Phiên bản:** v0.1.0-beta.1 (thử nghiệm). **Hệ điều hành:** Windows 10/11 x64.  
**Repository:** https://github.com/TDUmii/umi-bridge  
**English / Tiếng Việt:** [README.md](README.md) (English first, Vietnamese below)  
**Điều khiển:** ChatGPT web (MCP + OAuth). **Quản trị:** http://127.0.0.1:43127/admin

> [!WARNING]
> Dự án cho phép ChatGPT thao tác với file và thực thi PowerShell trên máy đã xác thực. Chỉ cấp quyền cho tài khoản ChatGPT bạn tin cậy. Nên sao lưu dữ liệu quan trọng, không tiết lộ mã kết nối và chỉ chạy lệnh mà bạn đã hiểu rõ.

## 1. Cài lần đầu trên một máy Windows khác

### Chuẩn bị

- Windows 10/11 x64, Internet.
- Node.js phiên bản **22.12.0+** cùng npm. Kiểm tra:

~~~powershell
node --version
npm --version
~~~

- Không cần Python, Docker, VS Code hay quyền Administrator cố định. Nếu máy công ty áp dụng chính sách hạn chế cài đặt/chạy PowerShell, bạn cần làm đúng quy định quản trị của máy.

### Tải mã nguồn

Tại GitHub, chọn **Code → Download ZIP**, sau đó giải nén vào thư mục thông thường (ví dụ `D:\Tools\UmiBridge`). Cũng có thể sử dụng Git:

~~~powershell
git clone https://github.com/TDUmii/umi-bridge.git
cd umi-bridge
~~~

### Thiết lập tự động

Mở PowerShell tại thư mục chứa `Setup-Local.ps1`, chạy:

~~~powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Setup-Local.ps1
~~~

Script:
1. `npm ci --ignore-scripts --no-audit --no-fund`: cài dependency chính xác theo `package-lock.json`.
2. `npm run build`: kiểm tra cú pháp các module Node.js.
3. Tải bản Windows x64 `cloudflared.exe` từ GitHub Cloudflare.
4. Đối chiếu digest SHA-256 của binary tải về.

Sau khi cài sẽ xuất hiện `node_modules/` và `local-bin/` trên máy. Cả hai không được đưa lên GitHub.

### Chạy

Nhấp đúp `Start-ChatGPT.cmd`. Chờ thông báo `Server URL`, `Authentication: OAuth` và mã kết nối. **Giữ cửa sổ này mở** khi dùng ChatGPT.

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

**Ngôn ngữ:** Giao diện mặc định là **English** cho người dùng quốc tế. Chọn **Tiếng Việt** trên thanh điều hướng ở góc phải để chuyển ngôn ngữ, hoặc chọn **English** để quay lại. Tùy chọn được lưu trên trình duyệt và không thay đổi dữ liệu request hoặc skill.


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
2. Nhấp đúp `Stop-ChatGPT.cmd`. Chờ `Desktop Commander Local stopped`.
3. Nhấp đúp `Start-ChatGPT.cmd`.
4. Mở lại `127.0.0.1:43127/admin`. Nếu trình duyệt giữ giao diện cũ, nhấn `Ctrl + Shift + R`.
5. Nếu URL tunnel đổi, cập nhật kết nối bên ChatGPT.

Script Stop kiểm tra PID lưu trong trạng thái local cùng tiến trình Node và cổng loopback. Tránh tắt hàng loạt tiến trình Node bằng `taskkill /IM node.exe /F`.

## 6. Các lỗi thường gặp

**`node is not recognized` / `npm is not recognized`:** Cài Node.js 22.12+, mở terminal mới. Nếu vẫn lỗi, kiểm tra PATH và chính sách máy.

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
| `node_modules/` | Dependency local | Không |

Chỉ source và hướng dẫn được đưa lên GitHub. **Không mang `.local-data/` khi chuyển máy** vì có thông tin kết nối và lịch sử riêng của máy cũ. Thực hiện Setup và OAuth mới trên máy thứ hai.

Lưu ý: Bộ lọc ghi lịch sử chỉ che những tên tham số nhạy cảm được nhận diện; không thể bảo đảm xóa sạch mọi bí mật trong chuỗi tùy ý. Tránh chạy câu lệnh chứa mật khẩu/token, không đăng log debug chứa đường dẫn cá nhân công khai.

## 8. Phát triển và kiểm thử

~~~powershell
npm ci --ignore-scripts --no-audit --no-fund
npm run build
npm run local:test
~~~

Mã nguồn: `scripts/chatgpt-backend.mjs` (9 công cụ file/terminal + 2 công cụ skill), `scripts/skill-library.mjs`, `scripts/local-web-gateway.mjs`, `scripts/local-admin.mjs` và `scripts/admin-dashboard.html`.

Gói phát hành beta trên GitHub là **source ZIP**, chưa phải trình cài đặt Windows. Mọi máy mới cần chạy Setup trước khi Start.

---

*UmiBridge ✿ Sakura Console — công cụ cá nhân hóa, dữ liệu nằm trên máy của bạn.*
