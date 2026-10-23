# UmiBridge Sakura Console

Cho phép ChatGPT đọc, sửa file, chạy lệnh và điều khiển giao diện Windows qua MCP, kèm dashboard local và điều khiển nhiều máy.

[Tải bản mới nhất](https://github.com/TDUmii/umi-bridge/releases/latest)

![UmiBridge Sakura Console](assets/umibridge-banner.svg)

## Cài và chạy

1. Giải nén bản phát hành vào một thư mục riêng.
2. Mở **UmiBridge.cmd**. Lần đầu launcher tự chuẩn bị Node.js, Python và bộ Windows tools, cài dependency đã khóa, kiểm tra source và tạo tunnel HTTPS cố định.
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
- **Tools**: bật/tắt công cụ, lệnh và xem hướng dẫn MCP tự động.
- **Skills**: chọn skill và xem nội dung trước khi dùng.
- **Requests**: tham số, stdout, stderr, exit code và thời gian chạy.
- **Settings**: endpoint, mã kết nối ban đầu, giao diện và chu kỳ làm mới.

## Chọn công cụ và skill

Mở **Tools**, chọn nhóm hoặc tìm công cụ rồi bật/tắt từng mục. Lựa chọn được lưu riêng trên máy và có hiệu lực cho lệnh mới, kể cả khi ChatGPT còn giữ danh sách công cụ cũ. Nhóm File, PowerShell và Windows áp dụng cho cả thao tác tương ứng trên máy phụ.

Trong **Skills**, bật những skill bạn muốn dùng, chẳng hạn `impeccable` hoặc `ui-ux-pro-max` cho thiết kế giao diện. Bật **hướng dẫn MCP tự động** trong Tools để UmiBridge gửi danh sách quyền hiện tại và các skill đã chọn khi kết nối; sau thay đổi, kết quả công cụ tiếp theo sẽ bổ sung hướng dẫn mới. Các kết quả sau đó kèm lời nhắc ngắn để chat mới dùng chung kết nối vẫn nhận được gợi ý skill. Xem trước nội dung ngay tại Tools. Model được hướng dẫn đọc skill phù hợp trước khi áp dụng; nội dung đầy đủ và script của skill không tự chạy.

Đây là hướng dẫn qua MCP, không sửa system prompt hoặc thay quyền xác nhận của ChatGPT. Công tắc kiểm soát từng tên công cụ, không tạo sandbox hệ điều hành: khi PowerShell được bật, lệnh shell vẫn có thể thao tác file và hệ thống. Tắt hướng dẫn tự động chỉ ngừng bổ sung prompt; các công cụ đã tắt vẫn bị từ chối. Mỗi mục lưu ngay, không cần nhập lại URL hoặc mã kết nối. Sau cập nhật bản phát hành, dùng **Làm mới công cụ** trong cài đặt plugin ChatGPT để cập nhật mô tả công cụ.

## Công cụ Windows

Bộ [Windows-MCP của CursorTouch](https://github.com/CursorTouch/Windows-MCP) được ghim tại commit `e28abb5c6934cb3427190bdb970e02644c915ae3`, chạy bằng stdio riêng dưới nền. Không mở thêm cổng, tạo scheduled task hay thay OAuth của UmiBridge. Telemetry và watchdog tùy chọn được tắt.

| Nhóm | Công cụ |
| --- | --- |
| Quan sát | `windows_snapshot`, `windows_screenshot`, `windows_display_inventory`, `windows_control_status` |
| Chuột và phím | `windows_click`, `windows_type`, `windows_scroll`, `windows_move`, `windows_shortcut`, `windows_multi_select`, `windows_multi_edit` |
| Ứng dụng và hệ thống | `windows_app`, `windows_process`, `windows_clipboard`, `windows_notification`, `windows_registry` |
| Nội dung và chờ | `windows_scrape`, `windows_file_system`, `windows_wait`, `windows_wait_for` |
| Trạng thái và máy phụ | `windows_status`, `windows_on_device` |

Dùng `windows_snapshot` trước khi bấm/gõ để lấy nhãn phần tử và tọa độ hiện tại. `windows_screenshot` trả ảnh thật; tham số `region` giới hạn vùng chụp. `windows_app` mở ứng dụng hoặc chuyển cửa sổ. Tiếp tục dùng `run_command` cho shell để giữ phiên PowerShell ẩn có sẵn.

**Settings → Windows tools → Pause** chặn các lệnh desktop mới, vẫn cho phép dùng file và PowerShell. Bộ điều phối quyền điều khiển của Windows-MCP giữ nguyên để người dùng giành lại chuột/phím. Máy cần có phiên desktop đang mở khóa; công cụ không điều khiển được UAC/secure desktop hay Session 0.

Ảnh trả trực tiếp qua MCP, không vào request journal. Nội dung gõ, clipboard và giá trị registry được che khỏi lịch sử. Token analytics chỉ đo text, không quy đổi ảnh thành token model. Công cụ desktop trên Agent cần cài cùng runtime; `windows_on_device` dùng nhãn/tọa độ của máy đích. Kết quả ảnh máy phụ chỉ giữ tạm trong bộ nhớ, tối đa tám kết quả; sau restart chỉ còn metadata job, cần chụp lại nếu muốn ảnh mới.

Dependency tải trong lần setup đầu, sau đó dùng cache local và lock SHA-256. Giữ `.runtime` khi cập nhật để tránh tải lại. License và nguồn tham khảo: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

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

Extract the latest release and open **UmiBridge.cmd**. The first launch prepares local Node/Python runtimes, hash-locked Windows-MCP dependencies and a reusable HTTPS tunnel. Later launches reuse the installed tools, URL and OAuth grants. Connect ChatGPT with the MCP endpoint and initial connection code shown under **Dashboard → Settings**. Keep ignored `.local-data` and `.runtime` when updating. Settings includes a pause/resume control for desktop tools; `windows_on_device` routes them to a linked Agent with the same runtime installed.

Optional actions use the same launcher: `-Action stop|repair|pair|agent`. Token analytics count observed tool text with an offline reference tokenizer; they are not provider billing or complete chat usage.

**Tools** persists per-tool access choices and rejects disabled tools even when a client has cached an old list. **Skills** controls which instruction documents can be read. Automatic MCP guidance includes the enabled tool and skill selection during initialization and after configuration changes; it never replaces ChatGPT system instructions or automatically runs skill scripts. Shell access remains broad OS access rather than a filesystem sandbox. All access settings stay in ignored local data and survive restart.

## License

MIT. Independent personal project; upstream DesktopCommanderMCP is not modified. See [LICENSE](LICENSE).
