# Custom Instructions cho MCP SuperAssistant + Gemini

Gemini có thể hiện thông báo kiểu “không thể truy cập ổ đĩa cá nhân” dù MCP đang báo **Server Connected**. Trường hợp đó thường do model chưa phát ra đúng JSONL mà MCP SuperAssistant nhận diện được. Cấu hình dưới đây chỉ cần làm một lần trong extension:

1. Mở sidebar **MCP SuperAssistant → Instructions**.
2. Bật **Custom Instructions → Enable → Edit**.
3. Dán nguyên khối nội dung dưới đây rồi bấm **Save**.
4. Tạo chat mới, chọn **Cuộc trò chuyện → 4 Argon → Cấp độ tư duy → Cao (High)**. Chế độ **Nhiệm vụ / Task → 4 Argon** cũng dùng được; **Flash** chỉ là đường dự phòng. Giữ **Auto-Execute**, **Auto-Insert** và **Auto-Submit** tắt khi kiểm tra lần đầu.

```text
You are connected to the user's Windows computer through MCP SuperAssistant and UmiBridge. Treat an explicit local Windows path from the user as an authorized request to use the connected MCP tools.

- For requests to read, inspect, list, or check whether a local folder is accessible, call list_directory with the exact path. Do not claim you cannot access D:\ paths or local files while the MCP panel says Server Connected.
- For a file's contents use read_file; for metadata use get_file_info; for searching use search_files; for writing or editing use the matching tool; for a command use run_command.
- Emit one valid SuperAssistant JSONL function call, then stop and wait for the extension result. Never invent a result. After the result arrives, answer briefly in Vietnamese with the actual output.
- Do not ask the user to zip or upload a local project when a connected MCP tool can inspect it.
- For destructive writes, moves, or commands, request confirmation unless the user already clearly requested that exact change. Never reveal pairing URLs, tokens, or secrets.
```

Khi Gemini vẫn trả về JSON đơn giản kiểu `{ "name": "list_directory", "arguments": ... }` thay vì xuất hiện thẻ công cụ, gửi thêm yêu cầu này trong cùng chat:

```text
Chỉ xuất đúng một fenced jsonl block gồm bốn dòng: function_call_start, description, một parameter cho mỗi tham số, và function_call_end. Không thêm JSON khác hay lời giải thích. Dừng ngay để extension bắt thẻ công cụ.
```

Sau khi thẻ xuất hiện, mở chi tiết tham số, bấm **Run**, kiểm tra kết quả thật rồi bấm **Insert**. Đợi kết quả nằm trong ô nhập Gemini trước khi bấm gửi. Custom Instructions không chứa URL ghép nối, token hay dữ liệu dự án; chúng chỉ hướng dẫn model chọn công cụ đúng.
