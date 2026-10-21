# Gemini web qua MCP SuperAssistant (thử nghiệm)

Đây là phương án dự phòng cho lỗi `Transport for env PROD not found in configuration` của custom app Gemini. Dùng giao diện Gemini web và tài khoản đang có; không dùng Gemini CLI hay API key.

## Cài đặt

1. Chạy `Setup-Gemini-Browser.cmd`. Script chuẩn bị UmiBridge, khởi động server ẩn, sao chép URL ghép nối local vào clipboard và mở trang extension cùng Gemini.
2. Cài [MCP SuperAssistant từ Chrome Web Store](https://chromewebstore.google.com/detail/mcp-superassistant/kngiafgkdnlkgmefdafaibkibegkcaef). Extension của bên thứ ba có quyền tương tác với các trang chat được hỗ trợ; xem quyền trong hộp cài đặt trước khi chấp nhận.
3. Tải lại Gemini. Trong sidebar của extension, bấm **Server settings**, chọn **Streamable HTTP**, dán URL trong clipboard rồi bấm **Save & Reconnect**. Chờ **Server Connected** và đủ **11 tools enabled**. URL có dạng `http://127.0.0.1:43127/gemini/<secret>/mcp`; đừng dùng URL mẫu này nguyên văn.
4. Tạo chat mới và mở **MCP → Instructions**, bật **Custom Instructions** rồi dán nội dung trong [hướng dẫn cấu hình một lần](GEMINI-CUSTOM-INSTRUCTIONS.md). Bước này ngăn Gemini rơi về câu trả lời mặc định rằng nó không thể truy cập ổ D: khi MCP đã kết nối. Để dùng đúng cấu hình người dùng yêu cầu, chọn **Cuộc trò chuyện → 4 Argon → Cấp độ tư duy → Cao (High)**. Chế độ **Nhiệm vụ → 4 Argon** cũng đã được kiểm tra. **Task / Flash** là đường dự phòng nhẹ hơn. Dùng [prompt ngắn đã thử](GEMINI-EXTENSION-PROMPT.md), thay đường dẫn ví dụ bằng file thử của bạn. Không chọn `@UmiBridge` của custom app trong chat kiểm tra này vì nó dùng đường kết nối khác.
5. Giữ **Auto-Execute** tắt trong lần kiểm tra đầu. Yêu cầu Gemini tạo một file thử không chứa dữ liệu riêng, đọc lại nội dung rồi chạy lệnh `Write-Output 'GEMINI_BROWSER_OK'`. Nếu Gemini trả JSON đơn giản mà chưa xuất hiện thẻ, yêu cầu nó xuất đúng bốn dòng JSONL theo [prompt ngắn](GEMINI-EXTENSION-PROMPT.md). Xem tham số trước khi bấm **Run** trên thẻ công cụ. Sau khi có kết quả, dùng chức năng chèn kết quả/tiếp tục của extension.
6. Khi có kết quả, bấm **Insert**, đợi nội dung xuất hiện trong ô nhập rồi mới bấm nút gửi của Gemini. Đối chiếu file trên ổ đĩa và lịch sử tại dashboard local do setup mở. Chỉ coi là thành công khi cả Gemini nhận kết quả và máy thực sự có file/lệnh tương ứng.

Setup kiểm tra health, xác thực URL riêng và danh sách công cụ bằng MCP trước khi mở trang kết nối. Nếu secret không hợp lệ hoặc gateway thiếu công cụ, setup dừng với lỗi đã ẩn thông tin cấp quyền. Có thể chạy lại riêng bước chẩn đoán bằng `node scripts/check-browser-connection.mjs`; đây là kiểm tra gateway, không phải bằng chứng Gemini đã gọi công cụ.

## Cách hoạt động và giới hạn

[Repo MCP SuperAssistant](https://github.com/srbhptl39/MCP-SuperAssistant) mô tả luồng phát hiện lời gọi công cụ trong câu trả lời AI, thực thi qua MCP rồi chèn kết quả vào chat. README của họ dùng [Desktop Commander](https://github.com/wonderwhy-er/DesktopCommanderMCP) làm ví dụ. UmiBridge dùng lại gateway hiện có qua Streamable HTTP, không cần cài thêm proxy npm riêng.

Kết nối extension đi thẳng tới loopback. Bộ mở dùng chế độ local, không khởi chạy hay yêu cầu đăng nhập tunnel. Nếu server đang ở chế độ public, script dừng riêng UmiBridge và chuyển sang local; ChatGPT từ xa không hoạt động trong chế độ này. Chạy `Start-UmiBridge.cmd` để chuyển lại chế độ public (cần tunnel còn đăng nhập). OAuth issuer và quyền đã lưu được giữ nguyên khi chuyển sang local. CORS chỉ được mở trên đúng đường dẫn có secret cho origin Gemini và ID extension chính thức; `/admin` và OAuth không được mở CORS thêm. Không dùng `Access-Control-Allow-Origin: *`.

URL ghép nối là thông tin cấp quyền. Chỉ dán vào cài đặt kết nối extension, không dán vào cuộc chat, ảnh chụp hoặc Git. Nó dùng chung secret với chế độ Gemini paired URL. Xóa `.local-data/gemini-pairing-secret.txt` rồi dừng/mở lại UmiBridge để thu hồi cả hai đường ghép nối. `/mcp` thông thường tiếp tục yêu cầu OAuth. Nhãn lịch sử `Gemini (paired URL)` chỉ mô tả đường kết nối, không chứng minh ai đã gửi lệnh.

Extension có thể thay đổi theo giao diện Gemini và có cơ chế cấu hình từ xa/analytics trong mã nguồn upstream. Bản UmiBridge không đóng gói hoặc tự sửa extension. Quyết định cài extension thuộc người dùng; không thay đổi chính sách trình duyệt hay lấy cookie đăng nhập.

## Trạng thái kiểm tra

- Đã kiểm tra CORS đúng origin, từ chối origin lạ/header quản trị, không mở CORS cho dashboard/OAuth, và MCP đọc file qua đường ghép nối.
- Các lần native custom app trước đó từng báo thiếu transport PROD. Sau khi làm mới cấu hình, native **Task / Flash** đã đọc, ghi file và chạy PowerShell thành công. Xem [báo cáo xác minh native](GEMINI-VERIFICATION.md).
- Ngày 21/10/2026 đã cài MCP SuperAssistant chính thức và kết nối trực tiếp loopback, đủ 11 công cụ. Gemini **Task / Flash** đã tạo lời gọi đọc, ghi, sửa file và chạy PowerShell; thẻ **Run** thực thi thành công, file thật và lịch sử local khớp, Gemini nhận stdout/stderr/exit code qua **Insert**. Sau restart cùng địa chỉ, extension kết nối lại và đọc đúng marker vừa thay trên ổ đĩa. Xem [báo cáo xác minh](GEMINI-EXTENSION-VERIFICATION.md).
- Kiểm tra tiếp ngày 21/10/2026: sau khi bật Custom Instructions và dùng Task / Flash, yêu cầu `list_directory` với `D:\Code\Linh tinh\NekoNest` đã trả về đúng bảy mục thật; Gemini nhận kết quả qua **Insert** và tóm tắt lại cấu trúc dự án. Đây là cấu hình cần dùng khi ảnh hưởng mặc định của model làm nó nói không truy cập được ổ D:.
- Kiểm tra Argon ngày 21/10/2026: chọn **Cuộc trò chuyện → 4 Argon → Cấp độ tư duy → Cao (High)**. Gemini đã phát thẻ `list_directory`, thẻ **Run** nhận đúng bảy mục thật từ `D:\Code\Linh tinh\NekoNest`, **Insert** đưa kết quả trở lại ô nhập và Gemini tóm tắt đúng 3 thư mục cùng 4 tệp. Sidebar giữ **Server Connected** và đủ 11 công cụ.
- Các lựa chọn model, giao diện và độ trễ do Gemini quyết định. Lần thử Chat / Flash và Flash-Lite chưa đạt; không suy rộng kết quả Task thành bảo đảm cho mọi model/tài khoản. Bản thử nghiệm extension không thay thế Latest beta.4 dành cho ChatGPT.
