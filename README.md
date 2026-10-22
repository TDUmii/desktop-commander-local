# UmiBridge · Sakura Console

ChatGPT và Gemini dùng công cụ trên máy Windows của bạn.

[Download](https://github.com/TDUmii/umi-bridge/releases/latest) · [Gemini](docs/GEMINI.md) · [Changelog](RELEASE_NOTES.md)

## Mở một file là chạy

1. Tải ZIP ở Releases, giải nén vào thư mục riêng.
2. Mở **UmiBridge.cmd**. Lần đầu cần internet; launcher chuẩn bị Node.js, dependency, kiểm tra build và thiết lập Dev Tunnel.
3. Đăng nhập tunnel một lần nếu được yêu cầu. Dashboard tự mở; terminal ở lại để theo dõi request.

Những lần sau chỉ mở **UmiBridge.cmd**. ChatGPT và Gemini dùng chung gateway. Launcher dùng lại địa chỉ, mã và quyền đã lưu, kiểm tra/sửa runtime, cập nhật Git khi working tree sạch. Thay đổi riêng không bị ghi đè. Khi chép source mới từ ZIP, giữ `.local-data` và `.runtime`.

Cần Windows 10/11 x64. Node.js >=22.12 được tải vào project nếu chưa có. Không cần Python, Docker, IDE hay Administrator. Đây là source ZIP có bootstrap, chưa phải MSI.

## Kết nối ChatGPT

1. Trong **Settings** của dashboard, sao chép MCP address.
2. Thêm custom MCP app trong ChatGPT, chọn **OAuth**. Client ID/Secret để trống nếu được hỏi, để đăng ký tự động DCR.
3. Khi trang UmiBridge yêu cầu, lấy **Copy initial connection code** trong dashboard và nhập tại trang cấp quyền. Không gửi mã vào chat.
4. Chọn UmiBridge trong chat và thử đọc một file không chứa dữ liệu riêng.

Chỉ cấp quyền cho tài khoản tin cậy: công cụ có thể đọc/sửa file và chạy lệnh dưới quyền Windows hiện tại. Dashboard chỉ mở tại [máy này](http://127.0.0.1:43127/admin). Custom app phụ thuộc tính năng tài khoản nhà cung cấp.

Địa chỉ và OAuth grant được giữ qua restart. Thu hồi quyền phía nhà cung cấp, hết đăng nhập tunnel hoặc xóa dữ liệu local có thể yêu cầu cấp quyền lại. Launcher giữ cấu hình cũ khi sửa host thất bại, không âm thầm đổi sang link tạm.

## Gemini

Mở PowerShell tại project, chạy `.\UmiBridge.cmd -Action gemini` một lần. Setup dùng lại gateway, sao chép URL riêng vào clipboard và mở Gemini/cửa hàng extension chính thức. Chỉ dán URL vào **Server settings → Streamable HTTP** của MCP SuperAssistant. Giữ kín URL chứa secret.

Chọn **Cuộc trò chuyện → 4 Argon → Cao (High)**, cấu hình theo [hướng dẫn Gemini](docs/GEMINI.md). Luồng kiểm tra: **xem tham số → Run → Insert → Gửi**. Connected chưa chứng minh Gemini đã chạy công cụ; đối chiếu file thật và lịch sử. Tương thích phụ thuộc Gemini và extension của bên thứ ba.

## Dashboard

| Mục | Công dụng |
| --- | --- |
| Overview | Trạng thái gateway và kết quả request |
| Analytics | Độ trễ, tỷ lệ thành công, hoạt động ngày/giờ và token công cụ |
| Projects & chats | Gắn một thư mục với một chat, tự gom request phù hợp |
| Devices | Ghép máy Windows khác, chọn máy và xem kết quả |
| Requests | Tham số, stdout, stderr, exit code; giữ chi tiết khi refresh |
| Settings | Giao diện, ngôn ngữ, refresh và kết nối |

Nhóm dự án đối chiếu thư mục và ứng dụng. Hai chat trùng thư mục thì để chưa gán; MCP không gửi conversation ID nên không thể tự xác định chính xác chat trong mọi trường hợp.

### Token

Tokenizer **o200k_base** chạy offline trên JSON đầu vào và block text đầu ra của công cụ, trước khi che log. Đây là số đếm theo bộ mã hóa tham chiếu đó, **không phải token thực tế/hóa đơn của ChatGPT hay Gemini**. Bridge không thấy toàn bộ chat, reasoning, ảnh, cache hoặc usage của model. Không cần API key trả phí.

Ước lượng byte/4 cũ không cộng vào tổng mới. Payload quá lớn/chuỗi liền quá dài được đánh dấu chưa đo để tránh chặn lệnh; byte vẫn đếm đầy đủ. Coverage thể hiện mức bao phủ. Tổng tích lũy khôi phục qua restart; lịch sử giữ 500 dòng gần nhất, API hiển thị trả 200 dòng. Hoạt động theo ngày giữ 31 ngày UTC; độ trễ/công cụ theo lịch sử gần nhất. Xóa lịch sử đặt lại thống kê.

### Lệnh không che màn hình

Backend và mỗi Agent chuẩn bị một PowerShell host ẩn, xếp hàng lệnh qua phiên đó. Timeout/crash/exit sẽ tạo lại phiên. `Start-Process`, `start`, `saps` mặc định Hidden; dùng `-WindowStyle Normal` khi chủ động muốn mở ứng dụng. Chạy console program trực tiếp để lấy stdout/stderr.

## Thêm máy khác

1. Giữ UmiBridge trên máy chính. **Devices → Pair device** tạo mã một lần.
2. Trên máy mới, giải nén project, chạy `UmiBridge.cmd -Action pair`; nhập server URL, mã và tên máy.
3. Lần sau mở **UmiBridge.cmd** trên máy mới. Khi đã ghép và chưa cấu hình Hub riêng, launcher tự chạy Agent.
4. Trong chat: “Liệt kê thiết bị, chạy lệnh này trên [tên máy]”. Kết quả trả về máy chính theo `device_id`.

Agent kết nối outbound, không cần cổng public riêng. Thu hồi máy tại Devices. Chỉ ghép máy bạn có quyền quản lý.

## Một file, các thao tác phụ

Mở PowerShell tại project khi cần:

| Thao tác | Lệnh |
| --- | --- |
| Chạy hằng ngày | `UmiBridge.cmd` |
| Dừng gateway | `UmiBridge.cmd -Action stop` |
| Sửa tunnel | `UmiBridge.cmd -Action repair` |
| Thiết lập Gemini | `UmiBridge.cmd -Action gemini` |
| Ghép máy | `UmiBridge.cmd -Action pair` |
| Chạy Agent | `UmiBridge.cmd -Action agent` |

Terminal giữ mở để theo dõi. **Ctrl+C** dừng monitor; gateway còn chạy nền. Helper nằm trong `scripts/windows`, không cần mở hằng ngày.

## Khi gặp lỗi

| Hiện tượng | Xử lý |
| --- | --- |
| Tool failed | Kiểm tra dashboard và URL app; sửa tunnel bằng `UmiBridge.cmd -Action repair` |
| Link tạm hết DNS | Dùng endpoint cố định trong Settings |
| Cổng đã có phiên | `UmiBridge.cmd -Action stop` rồi mở lại; không kill mọi node.exe |
| Dashboard không mở | Chờ launcher ready; xem `.local-data/server-error.log` tại máy |
| Gemini nói không đọc được ổ đĩa | Kiểm tra Custom Instructions/JSONL theo hướng dẫn Gemini |
| Chi tiết chưa hiện request mới | Đóng chi tiết đang đọc; tổng số vẫn tự cập nhật |

## Phát triển

`scripts/` chứa gateway/dashboard/helper, `test/` chứa kiểm thử, `assets/` chứa nhận diện, `docs/` chứa hướng dẫn Gemini.

```powershell
npm ci
npm run build
npm run local:test
```

`.local-data`, `.runtime`, `node_modules`, `local-bin`, log, token và cấu hình tài khoản không vào Git/ZIP. Giữ dữ liệu local khi cập nhật. Không commit ảnh chụp chứa danh tính/mã. Lịch sử che các secret đã biết và giới hạn tham số/output; không dùng log để lưu dữ liệu nhạy cảm.

## English

Extract the release ZIP and open **UmiBridge.cmd**. First launch prepares a local Node runtime, locked dependencies and a reusable tunnel. Keep the monitor open. ChatGPT and Gemini share one gateway; dashboard Settings provides the MCP address and initial OAuth code. See [Gemini setup](docs/GEMINI.md) for the optional third-party extension.

Optional operations use the same launcher with `-Action stop|repair|gemini|pair|agent`. Helpers live under `scripts/windows`. Preserve ignored `.local-data` when updating. Token analytics count observed tool text with an offline reference tokenizer, not provider billing or complete chat usage.

## License

MIT. Independent personal project; upstream DesktopCommanderMCP is not modified. See [LICENSE](LICENSE).
