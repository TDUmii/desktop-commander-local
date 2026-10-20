# Gemini web qua MCP SuperAssistant (thử nghiệm)

Đây là phương án dự phòng cho lỗi `Transport for env PROD not found in configuration` của custom app Gemini. Dùng giao diện Gemini web và tài khoản đang có; không dùng Gemini CLI hay API key.

## Cài đặt

1. Chạy `Setup-Gemini-Browser.cmd`. Script chuẩn bị UmiBridge, khởi động server ẩn, sao chép URL ghép nối local vào clipboard và mở trang extension cùng Gemini.
2. Cài [MCP SuperAssistant từ Chrome Web Store](https://chromewebstore.google.com/detail/mcp-superassistant/kngiafgkdnlkgmefdafaibkibegkcaef). Extension của bên thứ ba có quyền tương tác với các trang chat được hỗ trợ; xem quyền trong hộp cài đặt trước khi chấp nhận.
3. Tải lại Gemini. Trong sidebar của extension, mở trạng thái kết nối, chọn **Streamable HTTP**, dán URL trong clipboard và kết nối. URL có dạng `http://127.0.0.1:43127/gemini/<secret>/mcp`; đừng dùng URL mẫu này nguyên văn.
4. Bật công cụ cần dùng, dùng chức năng **Insert** của extension để đưa hướng dẫn công cụ vào một chat mới. Không chọn `@UmiBridge` của custom app trong chat kiểm tra này vì nó dùng đường kết nối khác.
5. Giữ **Auto-Execute** tắt trong lần kiểm tra đầu. Yêu cầu Gemini tạo một file thử không chứa dữ liệu riêng, đọc lại nội dung rồi chạy lệnh `Write-Output 'GEMINI_BROWSER_OK'`. Xem tham số trước khi bấm **Run** trên thẻ công cụ. Sau khi có kết quả, dùng chức năng chèn kết quả/tiếp tục của extension.
6. Đối chiếu file trên ổ đĩa và lịch sử tại `http://127.0.0.1:43127/admin`. Chỉ coi là thành công khi cả Gemini nhận kết quả và máy thực sự có file/lệnh tương ứng.

## Cách hoạt động và giới hạn

[Repo MCP SuperAssistant](https://github.com/srbhptl39/MCP-SuperAssistant) mô tả luồng phát hiện lời gọi công cụ trong câu trả lời AI, thực thi qua MCP rồi chèn kết quả vào chat. README của họ dùng [Desktop Commander](https://github.com/wonderwhy-er/DesktopCommanderMCP) làm ví dụ. UmiBridge dùng lại gateway hiện có qua Streamable HTTP, không cần cài thêm proxy npm riêng.

Kết nối extension đi thẳng tới loopback. Bộ mở dùng chế độ local, không khởi chạy hay yêu cầu đăng nhập tunnel. Nếu server đang ở chế độ public, script dừng riêng UmiBridge và chuyển sang local; ChatGPT từ xa không hoạt động trong chế độ này. Chạy `Start-UmiBridge.cmd` để chuyển lại chế độ public (cần tunnel còn đăng nhập). OAuth issuer và quyền đã lưu được giữ nguyên khi chuyển sang local. CORS chỉ được mở trên đúng đường dẫn có secret cho origin Gemini và ID extension chính thức; `/admin` và OAuth không được mở CORS thêm. Không dùng `Access-Control-Allow-Origin: *`.

URL ghép nối là thông tin cấp quyền. Chỉ dán vào cài đặt kết nối extension, không dán vào cuộc chat, ảnh chụp hoặc Git. Nó dùng chung secret với chế độ Gemini paired URL. Xóa `.local-data/gemini-pairing-secret.txt` rồi dừng/mở lại UmiBridge để thu hồi cả hai đường ghép nối. `/mcp` thông thường tiếp tục yêu cầu OAuth. Nhãn lịch sử `Gemini (paired URL)` chỉ mô tả đường kết nối, không chứng minh ai đã gửi lệnh.

Extension có thể thay đổi theo giao diện Gemini và có cơ chế cấu hình từ xa/analytics trong mã nguồn upstream. Bản UmiBridge không đóng gói hoặc tự sửa extension. Quyết định cài extension thuộc người dùng; không thay đổi chính sách trình duyệt hay lấy cookie đăng nhập.

## Trạng thái kiểm tra bản beta.6

- Đã kiểm tra CORS đúng origin, từ chối origin lạ/header quản trị, không mở CORS cho dashboard/OAuth, và MCP đọc file qua đường ghép nối.
- Custom app Gemini của lần thử beta.5 đã phát hiện 11 công cụ nhưng ghi file/chạy lệnh bị lỗi transport PROD trước khi đến gateway.
- **Chưa xác nhận thực thi toàn bộ luồng Gemini web qua extension.** Trong phiên phát triển beta.6, công cụ điều khiển Chrome cho đọc tab nhưng từ chối tạo/điều hướng tab, nên chưa cài và chạy thử extension trong tài khoản Gemini. Kiểm tra giao thức local không được tính là kiểm tra Gemini thành công.
