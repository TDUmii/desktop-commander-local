<div align="center">

<img src="assets/umibridge-banner.svg" alt="UmiBridge Sakura Console — cầu nối ChatGPT và Windows" width="100%">

### ✿ Your PC · Your rules · Your Sakura Console

**UmiBridge** kết nối ChatGPT web với máy Windows qua MCP và OAuth.

[Hướng dẫn cài đặt](#cài-đặt-trên-windows) · [Kết nối ChatGPT](#kết-nối-chatgpt) · [Dashboard](#sakura-console) · [Khắc phục sự cố](#xử-lý-sự-cố) · [Hướng dẫn chi tiết](LOCAL-README.vi.md)

</div>

> [!WARNING]
> **Phiên bản beta.** Khi được cấp quyền, ChatGPT có thể đọc/sửa tệp và chạy lệnh PowerShell trên máy của bạn. Chỉ kết nối tài khoản tin cậy; nên sao lưu dữ liệu quan trọng trước khi sử dụng. Không tiết lộ mã kết nối và token.

## UmiBridge là gì?

**UmiBridge · Sakura Console** là phiên bản mang nhận diện cá nhân của *Desktop Commander Local for ChatGPT*, với dashboard phong cách anime hiện đại: tím đêm, hồng sakura, hai chế độ sáng/tối, tối ưu cho quản lý request.

Các tính năng:
- Đọc, ghi, chỉnh sửa, tìm kiếm tệp và thư mục; tạo/di chuyển thư mục, xem metadata.
- Chạy lệnh PowerShell và trả đầu ra có giới hạn.
- Kết nối ChatGPT qua MCP Streamable HTTP + OAuth + Dynamic Client Registration (DCR).
- Dashboard nội bộ: request, thành công/lỗi, độ trễ trung bình/P95, biểu đồ 12 giờ, công cụ sử dụng nhiều, bộ lọc, Dark Mode, tự làm mới.
- **Gắn link và ID chat thủ công** vào request và mở lại cuộc trò chuyện.

**Không có tính năng tự thu thập hội thoại ChatGPT**; MCP không cung cấp conversation ID cho ứng dụng này.

## Yêu cầu

| Hạng mục | Yêu cầu |
|---|---|
| Máy tính | Windows 10 hoặc 11, x64 |
| Node.js | **22.12.0+**, có npm |
| Mạng | Internet cho cài đặt và kết nối HTTPS |
| Trình duyệt | Chrome, Edge hoặc trình duyệt hiện đại |
| ChatGPT | Quyền sử dụng kết nối MCP tùy chỉnh có OAuth/DCR; tùy gói và giao diện hiện hành |

Dự án là **source code Node.js**, chưa có bộ cài `.exe` độc lập. Không cần Python, Docker hoặc IDE.

## Cài đặt trên Windows

**1. Cài Node.js** từ [nodejs.org](https://nodejs.org/). Mở PowerShell **mới**, kiểm tra:

~~~powershell
node -v
npm -v
~~~

**2. Tải source:** Mở [GitHub repository](https://github.com/TDUmii/desktop-commander-local), chọn **Code → Download ZIP** và giải nén. Hoặc dùng Git:

~~~powershell
git clone https://github.com/TDUmii/desktop-commander-local.git
cd desktop-commander-local
~~~

**3. Cài dependency:** Trong thư mục có `Setup-Local.ps1`, chạy:

~~~powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Setup-Local.ps1
~~~

Setup chạy `npm ci`, kiểm tra mã nguồn và tải Cloudflare Tunnel Windows x64 từ GitHub với kiểm tra SHA-256. Không thay đổi execution policy cho toàn máy.

**4. Chạy:** Nhấp đúp **`Start-ChatGPT.cmd`**. Giữ cửa sổ đang mở. Terminal sẽ hiện:
- **Server URL:** địa chỉ HTTPS kết thúc bằng `/mcp`.
- **Authentication:** OAuth, Dynamic Client Registration.
- **Mã kết nối:** dùng trên trang xác thực, **không gửi qua chat**.
- **Dashboard:** [http://127.0.0.1:43127/admin](http://127.0.0.1:43127/admin) (chỉ trên máy chạy UmiBridge).

## Kết nối ChatGPT

1. Trong ChatGPT, mở phần cài đặt Plugins/Apps hoặc **MCP tùy chỉnh** (tên menu có thể khác nhau tùy phiên bản).
2. Thêm kết nối với tên hiển thị **UmiBridge**.
3. Dán chính xác **Server URL** từ terminal, bao gồm `/mcp`.
4. Chọn **OAuth**; nếu được hỏi, bật **Dynamic Client Registration (DCR)** và để trống Client ID/Secret.
5. Bật scope `desktop` và `offline_access` theo cài đặt hiện có.
6. Trên trang consent, nhập mã kết nối **trong terminal**. Không nhập mã vào cuộc trò chuyện.
7. Mở chat mới và chọn UmiBridge, thử **đọc một file không nhạy cảm**.

Cloudflare **Quick Tunnel thay đổi URL** khi khởi động lại; nếu kết nối cũ báo lỗi, cập nhật hoặc tạo lại server bằng link HTTPS mới.

## Sakura Console

Mở **http://127.0.0.1:43127/admin** trên máy đang chạy ứng dụng.

| Trang | Nội dung |
|---|---|
| Tổng quan | Tổng request, thành công/lỗi, trung bình, P95, request 24 giờ |
| Phân tích | Biểu đồ hoạt động 12 giờ, bảng xếp hạng công cụ |
| Chat liên kết | Link và Chat ID đã gắn thủ công với request |
| Lịch sử request | Thời gian, công cụ, trạng thái, tham số đã rút gọn, tìm kiếm/bộ lọc |

Để gắn link chat: **Lịch sử request → Chi tiết / Chat → dán URL `https://chatgpt.com/c/...` → Lưu liên kết**. ID được tách từ URL mà bạn cung cấp, không phải do MCP gửi.

> [!IMPORTANT]
> Ứng dụng **không tự biết** request thuộc cuộc trò chuyện nào. Việc gắn đúng chat là trách nhiệm của người sử dụng. Thống kê chỉ phản ánh lịch sử local đang lưu (tối đa 500 bản ghi), không phải toàn bộ lịch sử ChatGPT.

## Dừng và khởi động lại

Chạy **`Stop-ChatGPT.cmd`** và chờ thông báo dừng, sau đó chạy lại **`Start-ChatGPT.cmd`**. Nếu trang chưa cập nhật giao diện, nhấn **Ctrl + Shift + R**. Không dùng `taskkill /IM node.exe /F` vì sẽ đóng cả ứng dụng Node.js khác.

## Xử lý sự cố

| Lỗi | Cách xử lý |
|---|---|
| `EADDRINUSE` / Named Pipe đã dùng | Phiên cũ còn chạy; dùng `Stop-ChatGPT.cmd` rồi khởi động lại; xem [hướng dẫn kiểm tra PID](LOCAL-README.vi.md) |
| `node` / `npm` không nhận diện | Cài Node.js 22.12+, mở lại PowerShell, chạy `node -v` |
| `Missing cloudflared.exe` | Chạy lại `Setup-Local.ps1` và kiểm tra kết nối mạng |
| Không thấy trang admin | Bảo đảm app đang chạy; mở URL `127.0.0.1` trên chính máy đó |
| Cloudflare không có URL | Kiểm tra kết nối/firewall; xem nhật ký local `.local-data/tunnel.log` |
| ChatGPT báo 401/không kết nối | Kiểm tra OAuth, DCR, scopes và URL `/mcp` mới sau restart |
| UI vẫn là phiên bản cũ | Dừng tiến trình cũ, Start lại, sau đó Ctrl + Shift + R |
| Không thấy Chat ID | Mở chi tiết request và tự gắn URL chat chính xác |

## Bảo mật và dữ liệu

- Dashboard `/admin` chỉ truy cập qua **loopback**, không qua Quick Tunnel công khai.
- OAuth bảo vệ MCP, nhưng client đã được cấp quyền vẫn có thể thao tác trên máy trong phạm vi tool.
- `.local-data/` (mã kết nối, OAuth, lịch sử request, link chat) và `local-bin/` bị loại khỏi Git và gói source.
- Các trường nhạy cảm phổ biến được che trước khi lưu lịch sử, nhưng **không bảo đảm** mọi bí mật lồng trong lệnh/chuỗi tùy ý đều được che; tránh truyền API key/password trong câu lệnh.
- Không lưu raw tool output trong lịch sử.
- Xóa lịch sử từ dashboard sẽ xóa cả liên kết chat đã gắn.

## Cấu trúc

~~~text
UmiBridge/
├── Start-ChatGPT.cmd / Stop-ChatGPT.cmd
├── Stop-ChatGPT.ps1 / Setup-Local.ps1
├── package.json / package-lock.json
├── scripts/
│   ├── chatgpt-backend.mjs
│   ├── local-web-gateway.mjs
│   ├── local-admin.mjs
│   ├── admin-dashboard.html
│   ├── run-local-web.mjs
│   └── protect-local-data.ps1
├── test/local-gateway.test.mjs
├── assets/umibridge-banner.svg
├── .local-data/    (private, ignored)
└── local-bin/      (downloaded, ignored)
~~~

Kiểm thử từ thư mục source:

~~~powershell
npm ci --ignore-scripts --no-audit --no-fund
npm run build
npm run local:test
~~~

## Beta release

**UmiBridge · Sakura Console** — bản thử nghiệm, **chưa phải stable**. File ZIP của GitHub Release là **mã nguồn**, cần Node.js và chạy Setup để cài dependency. Xem [GitHub Releases](https://github.com/TDUmii/desktop-commander-local/releases).

License: [MIT](LICENSE).

<div align="center">

**Made for Umi ✿ Built for clarity, kept local.**

</div>
