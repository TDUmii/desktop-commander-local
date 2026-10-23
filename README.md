# UmiBridge Sakura Console

Cho phép ChatGPT đọc, sửa file và chạy lệnh trên máy Windows của bạn qua MCP, kèm dashboard local và điều khiển nhiều máy.

[Tải bản mới nhất](https://github.com/TDUmii/umi-bridge/releases/latest)

![UmiBridge Sakura Console](assets/umibridge-banner.svg)

## Cài và chạy

1. Giải nén bản phát hành vào một thư mục riêng.
2. Mở **UmiBridge.cmd**. Lần đầu launcher tự chuẩn bị Node.js, cài dependency đã khóa, kiểm tra source và tạo tunnel HTTPS cố định.
3. Nếu Microsoft Dev Tunnels yêu cầu đăng nhập, chọn GitHub một lần. Những lần sau launcher dùng lại URL, OAuth và mã kết nối đã lưu.
4. Mở dashboard tại `http://127.0.0.1:43127/admin` để xem trạng thái, endpoint, lịch sử lệnh, token tham chiếu, thiết bị và cài đặt.

Chỉ cần mở **UmiBridge.cmd** mỗi khi bật máy. Cửa sổ này theo dõi request; gateway và PowerShell worker chạy nền, không mở thêm terminal cho từng lệnh.

## Kết nối ChatGPT

Trong ChatGPT, thêm MCP connector bằng endpoint hiển thị ở **Dashboard → Settings**:

- Authentication: **OAuth**
- Client registration: **Dynamic (DCR)**
- Client ID và Client secret: để trống
- Khi UmiBridge hỏi mã: dùng **Connection code** trong Settings

Tunnel cố định giữ nguyên URL và quyền OAuth sau khi khởi động lại. Không gửi endpoint, connection code, token hoặc file trong `.local-data` cho người khác.

## Dashboard

- **Overview**: trạng thái gateway và tổng request.
- **Analytics**: độ trễ, tỷ lệ thành công và token tham chiếu của payload công cụ.
- **Projects & chats**: khai báo một thư mục và link ChatGPT để tự nhóm request.
- **Devices**: ghép thêm máy Windows và nhận kết quả theo `device_id`.
- **Skills**: bật/tắt hướng dẫn công cụ local.
- **Requests**: tham số, stdout, stderr, exit code và thời gian chạy.
- **Settings**: endpoint, mã kết nối ban đầu, giao diện và chu kỳ làm mới.

Token dùng tokenizer offline `o200k_base` trên nội dung công cụ mà UmiBridge nhìn thấy. Đây là số tham chiếu, không phải billing hay toàn bộ context của ChatGPT.

## Nhiều máy

Máy chính chạy gateway và dashboard. Trên máy phụ, chép cùng project rồi chạy:

```powershell
.\UmiBridge.cmd -Action pair
```

Nhập URL Hub và mã ghép một lần từ trang **Devices**. Sau đó dùng `UmiBridge.cmd -Action agent` trên máy phụ. Agent chỉ kết nối outbound và trả về `job_id`, stdout, stderr, exit code hoặc kết quả file. Thu hồi máy tại Devices khi không còn dùng.

## Các thao tác

| Thao tác | Lệnh |
| --- | --- |
| Chạy hằng ngày | `UmiBridge.cmd` |
| Dừng gateway | `UmiBridge.cmd -Action stop` |
| Sửa tunnel | `UmiBridge.cmd -Action repair` |
| Ghép máy | `UmiBridge.cmd -Action pair` |
| Chạy Agent | `UmiBridge.cmd -Action agent` |

## Khi gặp lỗi

| Hiện tượng | Xử lý |
| --- | --- |
| Tool failed | Kiểm tra Requests và endpoint trong Settings; chạy `UmiBridge.cmd -Action repair` nếu tunnel lỗi |
| Link tạm hết DNS | Dùng tunnel cố định và endpoint trong Settings |
| Cổng đã có phiên | Chạy `UmiBridge.cmd -Action stop`, rồi mở lại |
| Dashboard chưa mở | Chờ dòng `UmiBridge is ready`; xem `.local-data/server-error.log` trên máy |
| Chi tiết đang xem không cập nhật | Đóng chi tiết; tổng số vẫn được làm mới ở nền |

## Quyền riêng tư và phát triển

`.local-data`, `.runtime`, `node_modules`, `local-bin`, log, token và cấu hình tài khoản không vào Git hoặc source ZIP. Lịch sử giới hạn tham số/output và che các secret đã biết. Đừng dùng request history để lưu dữ liệu nhạy cảm.

```powershell
npm ci
npm run build
npm run local:test
```

## English

Extract the latest release and open **UmiBridge.cmd**. The first launch prepares a local Node runtime, locked dependencies and a reusable HTTPS tunnel. Later launches reuse the saved URL and OAuth grants. Connect ChatGPT with the MCP endpoint and initial connection code shown under **Dashboard → Settings**. Keep ignored `.local-data` when updating.

Optional actions use the same launcher: `-Action stop|repair|pair|agent`. Token analytics count observed tool text with an offline reference tokenizer; they are not provider billing or complete chat usage.

## License

MIT. Independent personal project; upstream DesktopCommanderMCP is not modified. See [LICENSE](LICENSE).
