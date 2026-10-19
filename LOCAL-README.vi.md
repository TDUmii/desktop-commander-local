# Desktop Commander Local cho ChatGPT web

Đây là project standalone dành riêng cho ChatGPT web. Project không cài đặt hoặc cấu hình Claude, Cursor, VS Code, remote device, telemetry, PDF/Office module hay các client AI khác.

## Cài lần đầu

1. Cài Node.js `22.12+`.
2. Mở PowerShell tại thư mục project và chạy:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\Setup-Local.ps1
```

Script cài dependency tối thiểu và tải `cloudflared` Windows x64 có kiểm tra SHA-256.

## Kết nối ChatGPT

1. Chạy `Start-ChatGPT.cmd`.
2. Giữ cửa sổ terminal mở. Tool sẽ in `Server URL` và mã kết nối.
3. Trong ChatGPT mở phần thêm MCP server tùy chỉnh.
4. Đặt tên `Desktop Commander Local PC`.
5. Dán `Server URL` được in trong terminal.
6. Chọn `OAuth`.
7. Mở cài đặt OAuth nâng cao.
8. Chọn `Đăng ký ứng dụng khách động (DCR)`.
9. Bật cả `desktop` và `offline_access`.
10. Tạo plugin, mở trang consent, nhập mã kết nối đang hiển thị trong terminal local.
11. Mở chat mới và chọn `@Desktop Commander Local PC`.

Không gửi mã kết nối vào nội dung chat. Mã chỉ dùng trong trang consent của server local.

## Tool được cung cấp

- `read_file`: đọc file văn bản theo dòng.
- `write_file`: ghi đè hoặc nối thêm file.
- `edit_block`: thay thế đúng một đoạn văn bản.
- `list_directory`: liệt kê file và thư mục.
- `create_directory`: tạo thư mục.
- `move_file`: di chuyển hoặc đổi tên.
- `get_file_info`: xem metadata.
- `search_files`: tìm chuỗi trong file văn bản.
- `run_command`: chạy PowerShell và trả về output có giới hạn.

## Trang quản trị request

Khi tool đang chạy, mở:

`http://127.0.0.1:43127/admin`

Trang có tổng số request, công cụ đã dùng, thời gian xử lý, trạng thái, tham số đã rút gọn và nút xóa lịch sử. Dữ liệu nằm trong:

`\.local-data\request-history.jsonl`

File này không được commit. Các khóa `content`, `data`, `input`, `password`, `secret`, `token`, `authorization` và `cookie` được che trước khi lưu. Raw kết quả của tool không được ghi vào lịch sử.

Trang admin chỉ mở qua loopback. Truy cập `/admin` qua Quick Tunnel công khai trả về `404`.

## Dừng tool

Chạy `Stop-ChatGPT.cmd`. Quick Tunnel tạo URL tạm thời, vì vậy sau mỗi lần khởi động lại cần kết nối ChatGPT bằng URL mới trong terminal.
