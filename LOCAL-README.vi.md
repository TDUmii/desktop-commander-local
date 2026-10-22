# UmiBridge ✿ Sakura Console - Hướng dẫn sử dụng chi tiết

**Phiên bản nhánh thử nghiệm:** v0.1.0-beta.11. **Latest dành cho ChatGPT:** beta.4. **Hệ điều hành:** Windows 10/11 x64.
**Repository:** https://github.com/TDUmii/umi-bridge  
**English / Tiếng Việt:** [README.md](README.md) (English first, Vietnamese below)
**Điều khiển:** ChatGPT web và Gemini web (MCP, OAuth hoặc URL ghép nối Gemini riêng). **Quản trị:** http://127.0.0.1:43127/admin

> [!WARNING]
> Dự án cho phép trợ lý đã kết nối thao tác với file và thực thi PowerShell trên máy đã xác thực. Chỉ cấp quyền cho tài khoản bạn tin cậy. Nên sao lưu dữ liệu quan trọng, không tiết lộ mã kết nối và chỉ chạy lệnh mà bạn đã hiểu rõ.

UmiBridge dùng kết nối MCP tùy chỉnh có sẵn trong ChatGPT hoặc Gemini. **Không cần API key của mô hình hay tiện ích trình duyệt** khi tài khoản có tính năng này. Hai dịch vụ dùng chung server và tunnel; OAuth dùng `/mcp`, Gemini có thêm URL ghép nối riêng tùy chọn. Dashboard vẫn chỉ mở trên máy local.

## 1. Cài lần đầu trên một máy Windows khác

### Chuẩn bị

- Windows 10/11 x64, Internet.
- Có Internet để chạy launcher một lần. Node.js **22.12.0+** là tùy chọn; nếu máy chưa có bản phù hợp, `UmiBridge.cmd` sẽ tự tải bản LTS Windows x64 chính thức vào thư mục dự án.
- Tài khoản ChatGPT hoặc Gemini có quyền thêm ứng dụng MCP tùy chỉnh. Kết nối thông thường dùng OAuth; điều kiện và lựa chọn Gemini được nêu tại mục 3.

- Không cần Python, Docker, VS Code hay quyền Administrator cố định. Nếu máy công ty áp dụng chính sách hạn chế cài đặt/chạy PowerShell, bạn cần làm đúng quy định quản trị của máy.

### Tải mã nguồn

Tại GitHub, chọn **Code → Download ZIP**, sau đó giải nén vào thư mục thông thường (ví dụ `D:\Tools\UmiBridge`). Cũng có thể sử dụng Git:

~~~powershell
git clone https://github.com/TDUmii/umi-bridge.git
cd umi-bridge
~~~

### Cài đặt một lần bằng cách nhấp đúp

Mở thư mục đã giải nén và nhấp đúp **`UmiBridge.cmd`**. Đây là file duy nhất cần mở hằng ngày; không cần mở PowerShell và không cần cài Node.js trước. Launcher sẽ tự:

1. Dùng Node.js sẵn có nếu đạt phiên bản tối thiểu, hoặc tải Node.js LTS chính thức vào `.runtime/`.
2. Cài dependency đúng theo `package-lock.json`.
3. Kiểm tra cú pháp mã nguồn.
4. Tải và kiểm tra runtime tunnel khi máy chưa có.
5. Dùng lại Dev Tunnel cố định nếu phiên đăng nhập còn hiệu lực; nếu hết hạn thì tự chuyển sang Quick Tunnel tạm để vẫn nhận lệnh.
6. Khởi chạy UmiBridge chạy nền rồi mở dashboard local.

Lần đầu cần Internet. Bộ cài không đổi execution policy toàn hệ thống và không cài phần mềm vào `Program Files`.

Terminal sẽ giữ nguyên sau khi khởi động và in một dòng đã che thông tin mỗi khi có request mới. Lấy `Server URL` và mã kết nối OAuth trong `.local-data/CONNECT.txt`. Sau đó chỉ cần nhấp đúp **`UmiBridge.cmd`**: launcher tự cập nhật khi source sạch, sửa runtime/build, kiểm tra tunnel/host, chạy gateway dùng chung cho ChatGPT và Gemini, mở dashboard và theo dõi request mà không in tham số hay output lệnh. Nhấn `Ctrl+C` để dừng theo dõi; dùng `Stop-ChatGPT.cmd` khi muốn dừng gateway.

### Thiết lập thủ công nâng cao

Mở PowerShell tại thư mục chứa `Setup-Local.ps1`, chạy:

~~~powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Setup-Local.ps1
~~~

Script thực hiện các bước giống bộ cài một lần nhưng không tự mở server.

Sau khi cài sẽ xuất hiện `.runtime/`, `node_modules/` và `local-bin/` trên máy. Các thư mục này không được đưa lên GitHub.

### Chạy

Lần đầu bộ cài sẽ mở `Start-ChatGPT.cmd`. Chờ thông báo `Server URL`, `Authentication: OAuth` và mã kết nối để kết nối ChatGPT. Sau khi OAuth hoàn tất, dùng `UmiBridge.cmd` để server chạy ẩn và dashboard tự mở, không che màn hình. Dùng lại `Start-ChatGPT.cmd` khi cần xem URL hoặc lỗi khởi động.

## 2. Kết nối ChatGPT bằng OAuth

**Khuyến nghị dùng địa chỉ cố định cho cả ChatGPT và Gemini:** nhấp đúp **`Setup-Stable-Connection.cmd`** một lần trước khi thêm ứng dụng. Script tải Dev Tunnels chính thức của Microsoft, kiểm tra chữ ký, mở đăng nhập GitHub và tạo tunnel cố định. Không cần mua tên miền. Các lần sau chỉ cần **`UmiBridge.cmd`**; launcher tự kiểm tra host. Nếu phiên Dev Tunnel hết hạn, launcher tự dùng Quick Tunnel tạm để gateway vẫn hoạt động; chạy lại setup này khi muốn khôi phục địa chỉ cố định.

Lấy URL `/mcp` tại dashboard và mã kết nối trong `.local-data/CONNECT.txt`. Khi trình duyệt hiện trang thông báo truy cập lần đầu của Microsoft, bạn tự xem và xác nhận trước khi vào OAuth. Nếu đã có app dùng link tạm cũ, tạo kết nối mới với URL cố định; nút “Kết nối lại” không tự thay URL đã lưu.

1. Mở ChatGPT và khu vực thêm **MCP server tùy chỉnh**. Tên menu có thể đổi tùy gói/phiên bản.
2. Nhập tên hiển thị **UmiBridge** (hoặc đặt tên tùy ý).
3. Dán nguyên **Server URL** kết thúc bằng `/mcp` từ dashboard hoặc cửa sổ UmiBridge. Sau thiết lập cố định, địa chỉ dùng `devtunnels.ms`; chế độ tạm dùng `trycloudflare.com`.
4. Chọn `OAuth`. Phần đăng ký client sử dụng `Dynamic Client Registration (DCR)`; không tự nhập Client ID hoặc Secret.
5. Nếu có các scope, bật `desktop` và `offline_access`.
6. Theo luồng consent trong trình duyệt, nhập **mã kết nối trên trang cấp quyền UmiBridge**. Lấy mã từ `.local-data/CONNECT.txt` hoặc cửa sổ `Start-ChatGPT.cmd` đang hiển thị. Dashboard chỉ hiện endpoint, không hiện mã.
7. Khi xác thực thành công, mở chat mới, chọn kết nối UmiBridge và thử một hành động đọc file không nhạy cảm.

**Mã kết nối không phải API key của ChatGPT.** Không gửi mã này qua tin nhắn hoặc công bố ảnh chụp màn hình chứa mã.

**Quick Tunnel** tạo URL HTTPS tạm. Sau khi dừng/chạy lại, cần xem `Server URL` mới và cập nhật plugin nếu URL đổi.

**Tunnel cố định:** giữ nguyên URL khi dùng lại cùng tunnel. OAuth được lưu tại máy và ràng buộc với URL đó, nên không mất chỉ vì khởi động lại. Access token vẫn hết hạn sau 15 phút; ChatGPT dùng refresh token để tự làm mới, kể cả khi chỉ yêu cầu scope `desktop`. Refresh token có hạn 30 ngày và được xoay sau mỗi lần dùng. Việc thu hồi quyền cũng được lưu. Request cấp quyền đang dở và mã xác thực dùng một lần không tồn tại qua lần khởi động lại.

Dev Tunnels là dịch vụ public preview. Microsoft xóa tunnel sau 30 ngày không hoạt động; nếu đăng nhập hosting hết hạn, chạy lại `Setup-Stable-Connection.cmd` để đăng nhập và dùng lại tunnel. Chi tiết: [CLI Microsoft](https://learn.microsoft.com/en-us/azure/developer/dev-tunnels/cli-commands), [FAQ](https://learn.microsoft.com/en-us/azure/developer/dev-tunnels/faq).

Tên menu và quyền thêm ứng dụng phụ thuộc phiên bản/tài khoản. Có thể đối chiếu với [hướng dẫn MCP chính thức của OpenAI](https://developers.openai.com/api/docs/guides/custom-mcp-server).

## 3. Kết nối Gemini web bằng ứng dụng MCP tùy chỉnh

Nếu ChatGPT đang dùng tunnel cố định, **dùng lại đúng URL đó cho Gemini qua OAuth**. Chế độ ghép nối tùy chọn bên dưới dùng đường dẫn riêng trên cùng tunnel. Không cần chạy server thứ hai, tạo tunnel khác hay đăng ký Gemini API.

1. Nhấp đúp **`Setup-Gemini.cmd`** trong thư mục UmiBridge. Script kiểm tra dependency, khởi động hoặc dùng lại server đang chạy dưới nền, sao chép URL kết nối hiện tại vào clipboard và mở [cài đặt ứng dụng Gemini bằng tiếng Anh](https://gemini.google.com/customize/connectors?hl=en). Script dùng OAuth `/mcp` nếu chưa cấu hình ghép nối riêng.
2. Tìm **Custom apps → Add a custom app**. Trên giao diện tiếng Việt có thể thấy **Tùy chỉnh → Tạo ứng dụng tùy chỉnh**.
3. Dán URL vừa sao chép, nhấn **Tiếp theo / Next**. UmiBridge hỗ trợ đăng ký client tự động (DCR), nên không cần tự điền Client ID hoặc Client Secret trong mục nâng cao.
4. Với OAuth, làm theo màn hình liên kết tài khoản Google và cấp quyền. Nếu trang UmiBridge yêu cầu mã kết nối, lấy mã trong `.local-data/CONNECT.txt` hoặc cửa sổ `Start-ChatGPT.cmd` đang hiển thị rồi nhập trên chính trang đó. Dashboard chỉ hiện endpoint, không hiện mã. Không dán mã vào cuộc trò chuyện.
5. Quay lại một chat hoặc tác vụ Gemini, gõ `@` và chọn ứng dụng UmiBridge vừa kết nối. Thử đọc một file không nhạy cảm trong dự án trước.
6. Khi Gemini chuẩn bị ghi file hoặc chạy lệnh, xem nội dung và xác nhận nếu đúng yêu cầu. Google hiện yêu cầu xác nhận thủ công với các thao tác ghi dữ liệu.

**Điều kiện tài khoản:** tài liệu Google hiện nêu tài khoản cá nhân, từ 18 tuổi, ở Mỹ, tiếng Anh và bật **Keep Activity**. Việc mở tính năng và ngôn ngữ giao diện có thể khác nhau giữa các tài khoản; một số tài khoản có nút tạo ứng dụng bằng tiếng Việt. Hãy kiểm tra trực tiếp mục **Custom apps / Tùy chỉnh** của bạn. UmiBridge không thể bật tính năng chưa được Google cấp cho tài khoản. Xem [hướng dẫn Custom Apps hiện tại của Google](https://support.google.com/gemini/answer/17209137).

Đây là kết nối ngay trên `gemini.google.com`; **không cần Gemini CLI, API key hay tiện ích trình duyệt**. Sau khi kết nối xong, các lần chạy hằng ngày chỉ dùng `UmiBridge.cmd` cho cả ChatGPT và Gemini.

### Tùy chọn khi cửa sổ OAuth của Google bị trắng

Nhấp đúp **`Setup-Gemini-Paired.cmd`** để tạo URL ghép nối riêng. Script tạo secret ngẫu nhiên 32 byte trong thư mục được bảo vệ `.local-data/gemini-pairing-secret.txt`, khởi động lại riêng UmiBridge và giữ các quyền OAuth đã cấp. URL đầy đủ được ghi vào `.local-data/GEMINI-CONNECT.txt`, sao chép vào clipboard và trang cài đặt Gemini được mở bằng tiếng Anh.

Dán URL này **chỉ vào ô MCP Server URL** khi tạo ứng dụng Gemini. Vẫn xem và xác nhận cảnh báo ứng dụng tùy chỉnh. Đường dẫn `/gemini/<random>/mcp` dùng chính URL để xác thực, không đi qua luồng liên kết tài khoản OAuth riêng. Sau khi cấu hình, `Setup-Gemini.cmd` sẽ tự dùng lại URL ghép nối.

**Coi toàn bộ URL như mật khẩu:** ai có URL đầy đủ có thể gọi các công cụ được mở. Nó không có chu kỳ hết hạn/làm mới OAuth hay quyền riêng theo từng client; URL dùng lại được đến khi thu hồi. Không dán vào chat, ảnh chụp hay Git. Để thu hồi, xóa `.local-data/gemini-pairing-secret.txt`, chạy `Stop-ChatGPT.cmd` rồi `UmiBridge.cmd`. Sau đó có thể kết nối Gemini lại bằng OAuth thông thường. Đường dẫn `/mcp` thông thường vẫn yêu cầu OAuth.

**Kiểm tra Gemini thực tế ngày 20/10/2026:** custom app trong **Task / Flash** đã đọc file mẫu, ghi file mới, đọc lại và chạy PowerShell với exit code 0. Marker được đối chiếu trên ổ đĩa và lịch sử gateway. Các lần trước từng báo `Transport for env PROD not found in configuration`; sau khi làm mới/tạo lại cấu hình app, lệnh thật đã tới gateway. Chưa cô lập được nguyên nhân chính xác của lỗi cấu hình trước đó. Nhãn đã kết nối không đủ chứng minh hoạt động; cần thử thao tác file thật. Xem [báo cáo xác minh](GEMINI-VERIFICATION.md).

## 4. Dashboard Sakura Console

**Gemini web qua extension (beta.7 thử nghiệm):** chạy `Setup-Gemini-Browser.cmd` để kiểm tra kết nối local, mở MCP SuperAssistant và sao chép URL Streamable HTTP riêng. Đã kiểm tra **Cuộc trò chuyện → 4 Argon → Cấp độ tư duy → Cao (High)**: Gemini tạo thẻ `list_directory`, chạy thật qua **Run**, nhận kết quả bằng **Insert** và tóm tắt đúng thư mục local. **Task / Flash** đã được kiểm tra thêm với đọc, ghi, sửa file, chạy PowerShell và đọc dữ liệu mới sau restart. Nếu Gemini vẫn nói không truy cập được ổ D: dù sidebar báo đã kết nối, bật [Custom Instructions một lần](GEMINI-CUSTOM-INSTRUCTIONS.md). Xem [hướng dẫn](GEMINI-BROWSER.vi.md), [prompt ngắn](GEMINI-EXTENSION-PROMPT.md) và [báo cáo xác minh](GEMINI-EXTENSION-VERIFICATION.md). Latest beta.4 dành cho ChatGPT được giữ nguyên.

**Ngôn ngữ:** Giao diện mặc định là **English** cho người dùng quốc tế. Chọn **Tiếng Việt** trên thanh điều hướng ở góc phải để chuyển ngôn ngữ, hoặc chọn **English** để quay lại. Tùy chọn được lưu trên trình duyệt và không thay đổi dữ liệu request hoặc skill.


Địa chỉ: **http://127.0.0.1:43127/admin**, chỉ mở **trên máy đang chạy UmiBridge**.

| Trang | Nội dung |
|---|---|
| Tổng quan | Trạng thái, tổng request, thành công/lỗi, 24 giờ, độ trễ trung bình và P95 |
| Phân tích | Biểu đồ 12 giờ, công cụ được gọi nhiều |
| Chat liên kết | Cuộc trò chuyện ChatGPT hoặc Gemini đã gắn với request |
| Skill Center | Các skill Codex/Agents cài trên máy, bật/tắt, xem nội dung, thêm/bỏ gắn |
| Lịch sử request | Tìm kiếm, bộ lọc, thời gian, công cụ, kết quả, tham số đã rút gọn |

Có thể bật/tắt Dark Mode bằng biểu tượng góc trên phải và bật **Tự cập nhật** (mỗi 20 giây).

**Mốc 500 chỉ giới hạn lịch sử gần đây trong bộ nhớ, không giới hạn số lệnh.** Gateway tiếp tục thực thi request 501 trở đi. Tổng đã nhận, thành công và lỗi tính từ lần xóa lịch sử gần nhất, được khôi phục từ journal local khi khởi động lại. Độ trễ, biểu đồ và xếp hạng công cụ tính trên 500 bản ghi mới nhất; bảng hoạt động tải 200 request gần nhất. Dữ liệu đã rút gọn được ghi nối tiếp vào `.local-data/request-history.jsonl`, nên file này tăng dần đến khi chọn **Xóa lịch sử**; thao tác đó cũng đặt lại bộ đếm và xóa link chat đã gắn. Lịch sử và bộ đếm không được gửi lên GitHub.

### Link và ID cuộc trò chuyện

Lịch sử hiển thị nhãn ứng dụng/nhà cung cấp khi nhận diện được client. Nhãn này **không cho biết request thuộc cuộc trò chuyện nào**; giao thức MCP không tự gửi ID chat hoặc đường dẫn chat. Để liên kết thủ công:

1. Sao chép URL cuộc trò chuyện hoặc link chia sẻ của ChatGPT hay Gemini.
2. Mở **Lịch sử request**, tìm đúng request (thời gian/công cụ).
3. Nhấn **Chi tiết / Chat**, dán URL. Các dạng được hỗ trợ gồm `https://chatgpt.com/c/...`, `https://chatgpt.com/share/...`, `https://gemini.google.com/app/...`, `https://gemini.google.com/share/...` và link ngắn Gemini sao chép ra `https://g.co/gemini/share/...`.
4. Nhấn **Lưu liên kết**. UmiBridge sẽ tách Chat ID từ URL và lưu ở máy này.
5. Dùng **Mở chat** để trở về đúng dịch vụ.

Nếu gắn nhầm, chọn **Bỏ gắn**; không có chức năng tự nhận diện chat nào tạo request nào.

## 5. Skill Center - dùng skill cũ và tự thêm skill

UmiBridge **không sao chép skill riêng tư của bạn lên GitHub**. Khi khởi động, nó tìm `SKILL.md` từ:

- `%USERPROFILE%\.codex\skills\<tên-skill>\SKILL.md`
- `%USERPROFILE%\.agents\skills\<tên-skill>\SKILL.md`
- `.agents\skills\<tên-skill>\SKILL.md` bên trong repository, nếu có
- Thư mục thêm thủ công mà bạn tự chỉ định

Bảy skill được ưu tiên: `ui-ux-pro-max`, `impeccable`, `frontend-checklist-global`, `playwright-cli`, `ponytail`, `api-security-testing`, `find-security-vulnerabilities-in-code`.

**Các skill ưu tiên tự bật nếu tìm thấy `SKILL.md` hợp lệ.** Skill khác phát hiện được để ở trạng thái tắt mặc định để tránh đọc nhầm tài liệu chưa kiểm tra.

### Dùng skill với ChatGPT hoặc Gemini

Trong chat, có thể viết:

> "Dùng UmiBridge `list_skills` để liệt kê skill trên máy, sau đó gọi `read_skill` cho `ui-ux-pro-max` và áp dụng nguyên tắc của skill để thiết kế lại UI trang chủ dự án."

`list_skills` trả tên/mô tả/trạng thái (không gửi đường dẫn tuyệt đối). `read_skill` trả nội dung file `SKILL.md` **chỉ của skill đang bật**. Script trong skill không tự chạy; nếu cần chạy, trợ lý phải thao tác riêng và người dùng cần kiểm tra mức độ tin cậy.

### Thêm skill tùy ý

1. Cài hoặc sao chép skill hợp pháp từ một nguồn tin tưởng vào thư mục riêng. Thư mục phải có file `SKILL.md`.
2. Mở `/admin → Skill Center`.
3. Dán đường dẫn tuyệt đối tới **thư mục chứa file**, ví dụ `D:\MySkills\my-new-skill`.
4. Nhấn **Thêm skill** và kiểm tra mục vừa xuất hiện.
5. Nhấn **Xem hướng dẫn** để đọc, dùng **Bật/Tắt** để quản lý.
6. **Bỏ gắn** chỉ xóa liên kết khỏi UmiBridge, **không xóa file nguồn**.

Không tự động cài skill từ GitHub URL, không tự tải dependency và không chạy code của skill. Nếu muốn sử dụng scripts đi kèm, hãy đánh giá nội dung thủ công trước.

Cấu hình nằm trong `.local-data/skill-registry.json`, không được commit.

## 6. Dừng và khởi động lại an toàn

1. Đóng các tác vụ file đang chạy dở.
2. Nhấp đúp `Stop-ChatGPT.cmd`. Chờ `UmiBridge stopped`.
3. Nhấp đúp `UmiBridge.cmd`.
4. Mở lại `127.0.0.1:43127/admin`. Nếu trình duyệt giữ giao diện cũ, nhấn `Ctrl + Shift + R`.
5. Nếu URL tunnel đổi, cập nhật kết nối bên ChatGPT và Gemini. Tunnel cố định giúp tránh đổi URL sau mỗi lần chạy.

Script Stop kiểm tra PID lưu trong trạng thái local cùng tiến trình Node và cổng loopback. Tránh tắt hàng loạt tiến trình Node bằng `taskkill /IM node.exe /F`.

## 7. Các lỗi thường gặp

**`node is not recognized` / `npm is not recognized`:** Nhấp đúp `UmiBridge.cmd` lại khi có Internet. Launcher sẽ tự thêm Node.js portable vào `.runtime/`; không cần sửa PATH hệ thống.

**`EADDRINUSE` hoặc named pipe đã có phiên giữ:** Một phiên UmiBridge đã chạy. Sử dụng `Stop-ChatGPT.cmd`, không chạy đè hai cửa sổ Start. Nếu Stop không dừng được, kiểm tra PID và đảm bảo đó là phiên của chính project trước khi dừng thủ công.

**Setup không tải được cloudflared:** Kiểm tra firewall/proxy/Internet, có thể thử kết nối lại và chạy lại Setup. Không tải file .exe từ nguồn không rõ.

**Chạy nền không thành công:** Mở `.local-data/server-error.log` để xem lỗi. Có thể chạy `Start-ChatGPT.cmd` một lần để xem trực tiếp thông báo khởi động.

**Không thấy dashboard:** Kiểm tra terminal UmiBridge có đang chạy không; URL phải là `http://127.0.0.1:43127/admin` trên đúng máy. Nếu sử dụng cổng `DC_WEB_PORT` khác, thay bằng cổng bạn đã chọn.

**ChatGPT bị 401/không kết nối:** Kiểm tra URL HTTPS có `/mcp`, DCR, OAuth và scopes; URL Quick Tunnel cũ không còn hợp lệ khi restart.

**Gemini không có mục Tùy chỉnh / Custom apps:** Kiểm tra điều kiện và tình trạng mở tính năng theo tài khoản trong tài liệu Google ở mục 3. Không đổi cấu hình máy hoặc mua API key để tìm cách bật menu này.

**Gemini không kết nối được:** Chạy lại `Setup-Gemini.cmd` để sao chép đúng URL đang hoạt động, hoàn tất luồng kết nối đã chọn và giữ UmiBridge chạy. Nếu Gemini yêu cầu bạn xác nhận thao tác ghi, cần xem và xác nhận trước khi tiếp tục.

**Cửa sổ OAuth Google chỉ hiện trang trắng:** Có thể thử `Setup-Gemini-Paired.cmd` theo mục 3. URL ghép nối là thông tin cấp quyền, cần giữ kín.

**Không thấy skill đã cài:** Kiểm tra tên thư mục, file `SKILL.md` có thật, không phải symlink và không vượt 128 KiB. Nếu skill nằm ngoài thư mục Codex chuẩn, thêm bằng đường dẫn tuyệt đối trong Skill Center. Nếu vừa cài, nhấn làm mới trang admin.

**Skill đọc bị lỗi "đang tắt":** Vào Skill Center → **Bật** rồi yêu cầu ChatGPT gọi `read_skill` lại.

**Bộ đếm trước đây đứng ở 500:** Cập nhật beta.11 và tải lại dashboard. Đây là giới hạn cửa sổ lịch sử, không phải số lệnh được phép chạy; bộ đếm mới đọc lại tất cả request hợp lệ trong journal và tiếp tục tăng sau 500.

**Dữ liệu dashboard bị rỗng:** Chỉ các lời gọi công cụ đi qua UmiBridge được ghi lại. Dashboard giữ 500 bản ghi gần nhất trong bộ nhớ và tải 200 bản ghi vào bảng; tổng request lấy từ toàn bộ journal kể từ lần xóa lịch sử gần nhất. Các request ngoài tool hoặc từ hệ thống khác sẽ không xuất hiện.

## 8. Dữ liệu riêng tư và vận hành trên máy khác

| Đường dẫn | Loại dữ liệu | Có push GitHub? |
|---|---|---|
| `.local-data/connection-secret.txt` | Mã kết nối | Không |
| `.local-data/CONNECT.txt` | Hướng dẫn và mã kết nối local | Không |
| `.local-data/gemini-pairing-secret.txt` | Secret ghép nối Gemini tùy chọn | Không |
| `.local-data/GEMINI-CONNECT.txt` | URL đầy đủ có quyền gọi công cụ | Không |
| `.local-data/oauth-state.json` | OAuth clients và quyền đã cấp | Không |
| `.local-data/tunnel-config.json` | Cấu hình tunnel riêng của máy | Không |
| `.local-data/web-status.json` | PID và URL tunnel | Không |
| `.local-data/request-history.jsonl` | Lịch sử đã rút gọn | Không |
| `.local-data/chat-links.json` | Link/ID chat gắn thủ công | Không |
| `.local-data/skill-registry.json` | Path + trạng thái skill | Không |
| `local-bin/` | Binary Cloudflare tải về | Không |
| `.runtime/` | Node.js portable của riêng dự án | Không |
| `node_modules/` | Dependency local | Không |

Chỉ source và hướng dẫn được đưa lên GitHub. **Không mang `.local-data/` khi chuyển máy** vì có thông tin kết nối và lịch sử riêng của máy cũ. Không đưa profile trình duyệt, thông tin tài khoản, mã kết nối, URL tunnel cá nhân hay log runtime vào gói source. Thực hiện Install và OAuth mới trên máy thứ hai.

Lịch sử `run_command` hiển thị ngay trong `/admin`: câu lệnh, thư mục chạy, exit code, stdout và stderr giới hạn. Bộ lọc chỉ che những secret và đường dẫn phổ biến; không thể bảo đảm xóa sạch mọi bí mật trong chuỗi tùy ý. Tránh chạy câu lệnh chứa mật khẩu/token, không đăng log debug chứa đường dẫn cá nhân công khai.

## 9. Phát triển và kiểm thử

~~~powershell
npm ci --ignore-scripts --no-audit --no-fund
npm run build
npm run local:test
~~~

Mã nguồn: `scripts/chatgpt-backend.mjs` (9 công cụ file/terminal + 2 công cụ skill), `scripts/skill-library.mjs`, `scripts/local-web-gateway.mjs`, `scripts/local-admin.mjs` và `scripts/admin-dashboard.html`.

Gói phát hành beta trên GitHub là **source ZIP có launcher bootstrap một lần**, chưa phải MSI. Mỗi máy mới chạy `UmiBridge.cmd`, thiết lập tunnel cố định được khuyến nghị rồi kết nối tài khoản ChatGPT hoặc chạy `Setup-Gemini.cmd` để kết nối Gemini.

---

*UmiBridge ✿ Sakura Console - công cụ cá nhân hóa, quản trị trên máy của bạn.*
