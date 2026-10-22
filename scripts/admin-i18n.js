/**
 * UmiBridge admin localization: English by default, opt-in Vietnamese.
 * Translates only known UI strings. Never translates tool payloads, SKILL.md or user content.
 */
(() => {
  'use strict';
  const VI_TO_EN = {
  "Chuyển đến nội dung chính": "Skip to main content",
  "Điều hướng nội bộ": "Sidebar navigation",
  "UmiBridge, về tổng quan": "UmiBridge, back to overview",
  "Các mục": "Sections",
  "Tổng quan": "Overview",
  "Phân tích": "Analytics",
  "Chat liên kết": "Linked chats",
  "Lịch sử request": "Request history",
  "Cài đặt": "Settings",
  "Chỉ truy cập từ máy local. Link chat chỉ được lưu khi bạn chủ động gắn vào request.": "Accessible only from this computer. Chat links are stored only when you add them.",
  "Đang kiểm tra...": "Checking...",
  "Không gian điều khiển ChatGPT/Gemini của riêng bạn, mọi hoạt động đều rõ ràng và trong tầm tay.": "Your own ChatGPT/Gemini control space, with everything clear and within reach.",
  "Tự cập nhật: Tắt": "Auto-refresh: Off",
  "Tự cập nhật: Bật": "Auto-refresh: On",
  "Làm mới": "Refresh",
  "Làm mới mỗi 20 giây": "Refresh every 20 seconds",
  "Đổi giao diện sáng/tối": "Toggle light or dark theme",
  "Nhìn nhanh kết nối, lịch sử và hiệu năng công cụ. Dữ liệu chỉ lưu trên máy của bạn.": "See your connection, activity, and tool performance at a glance. All data stays on this computer.",
  "Thời gian chạy gateway": "Gateway uptime",
  "Request trong 24 giờ": "Requests in 24 hours",
  "Tổng yêu cầu": "Total requests",
  "Lịch sử đang lưu · tối đa 500": "Stored history · up to 500",
  "Thành công": "Successful",
  "Tỉ lệ thành công: —": "Success rate: —",
  "Có lỗi": "Failed",
  "Tỉ lệ lỗi: —": "Error rate: —",
  "Độ trễ trung bình": "Average latency",
  "Hoạt động theo giờ": "Hourly activity",
  "Số request được ghi lại trong 12 giờ gần nhất": "Requests recorded in the last 12 hours",
  "12 GIỜ": "12 HOURS",
  "Tổng 12 giờ:": "Last 12 hours:",
  "Lần cập nhật:": "Updated:",
  "Công cụ được sử dụng nhiều": "Most-used tools",
  "Thống kê theo số lần gọi trong lịch sử": "Ranked by calls in stored history",
  "Đang tải thống kê...": "Loading statistics...",
  "Cuộc trò chuyện liên kết": "Linked conversations",
  "Chưa có link chat": "No chat links yet",
  "Gắn link vào request tại bảng lịch sử để mở lại cuộc trò chuyện.": "Link a request in the activity table to reopen its conversation.",
  "ChatGPT và Gemini không tự gửi conversation ID qua MCP. Link và ID bên dưới chỉ xuất hiện khi bạn tự gắn.": "ChatGPT and Gemini do not provide conversation IDs through MCP. Links and IDs appear only when you add them manually.",
  "Thông tin hệ thống": "System information",
  "Loại công cụ": "Unique tools",
  "Hoạt động gần nhất": "Last activity",
  "P95 xử lý": "P95 duration",
  "Lịch sử hiển thị": "Visible history",
  "MCP endpoint · không chứa mã đăng nhập": "MCP endpoint · no credentials",
  "Chưa tải dữ liệu": "No data loaded",
  "Tự nhận diện skill Codex đã cài. Chỉ skill bật mới được đọc qua MCP.": "Automatically discover installed Codex skills. Only enabled skills can be read through MCP.",
  "Đang tìm các skill có trên máy...": "Looking for locally installed skills...",
  "+ Thêm skill của bạn": "+ Add your own skill",
  "Nhập đường dẫn tới thư mục có file SKILL.md. Không tải script tự động, không sao chép file nguồn.": "Enter the folder containing SKILL.md. No scripts are executed and source files are not copied.",
  "Đường dẫn thư mục skill": "Skill folder path",
  "+ Thêm skill": "+ Add skill",
  "Hướng dẫn SKILL.md": "SKILL.md instructions",
  "Đóng": "Close",
  "Chỉ hiển thị nội dung hướng dẫn. Script trong skill không tự chạy.": "Only the instructions are shown. Scripts in the skill never run automatically.",
  "✧ Các skill đề xuất được bật mặc định": "✧ Recommended skills are enabled by default",
  "khi đã cài trên máy": "when installed on this computer",
  ". Bạn có thể tắt/bật từng skill. Thêm mới chỉ tạo liên kết local, không chỉnh sửa thư mục Codex.": ". You can enable or disable each skill. Adding a skill only creates a local reference; it does not change your Codex files.",
  "Tìm kiếm, mở chi tiết, gắn link và ID chat vào từng yêu cầu.": "Search, inspect, and manually associate chat links and IDs with requests.",
  "Chưa cập nhật": "Not updated yet",
  "Tìm tên công cụ, ID hoặc tham số": "Search tool names, IDs, or parameters",
  "Lọc trạng thái": "Filter status",
  "Mọi trạng thái": "All statuses",
  "Lọc công cụ": "Filter tools",
  "Mọi công cụ": "All tools",
  "Lọc khoảng thời gian": "Filter time range",
  "Mọi thời gian": "Any time",
  "24 giờ qua": "Past 24 hours",
  "7 ngày qua": "Past 7 days",
  "Sắp xếp thời gian": "Sort by time",
  "Mới nhất": "Newest first",
  "Cũ nhất": "Oldest first",
  "Thời gian": "Time",
  "Công cụ": "Tool",
  "Thời lượng": "Duration",
  "Trạng thái": "Status",
  "Chat / Chi tiết": "Chat / Details",
  "Đang tải lịch sử": "Loading history",
  "Vui lòng kiểm tra gateway đang hoạt động.": "Please check that the gateway is running.",
  "Lệnh và output giới hạn chỉ lưu trên máy, có che cơ bản secret và đường dẫn.": "Commands and bounded output stay local with basic secret and path redaction.",
  "Xem thêm": "Load more",
  "Xóa lịch sử": "Clear history",
  "/admin · Dữ liệu liên kết chat lưu tại máy này": "/admin · Chat associations stay on this computer",
  "Phân tích hoạt động": "Activity analytics",
  "Chưa có dữ liệu biểu đồ": "No chart data yet",
  "Sao chép địa chỉ MCP": "Copy MCP address",
  "Tìm công cụ, ID, tham số...": "Search tools, IDs, arguments...",
  "Gateway local hoạt động": "Local gateway connected",
  "Không kết nối được": "Connection lost",
  "Tỉ lệ thành công:": "Success rate:",
  "Tỉ lệ lỗi:": "Error rate:",
  "Chưa có dữ liệu theo giờ.": "No hourly data available.",
  "Chưa có hoạt động để thống kê.": "No activity to analyze yet.",
  "Chưa có chat nào được gắn": "No linked chats yet",
  "Mở chi tiết một request phía dưới, dán link ChatGPT hoặc Gemini rồi lưu. Hệ thống sẽ đọc ID từ đường dẫn đó.": "Open a request below, paste its ChatGPT or Gemini URL, and save it. The ID will be extracted from the URL.",
  "Mở cuộc trò chuyện": "Open conversation",
  "Mở chat": "Open chat",
  "Đã gắn · Chat ID:": "Linked · Chat ID:",
  "Chi tiết request": "Request details",
  "Mã request:": "Request ID:",
  "Sao chép mã request": "Copy request ID",
  "Liên kết ChatGPT / Gemini": "ChatGPT / Gemini association",
  "Dán URL của cuộc trò chuyện mà bạn biết đã tạo request này. Liên kết này được gắn thủ công, không phải dữ liệu ứng dụng tự cung cấp.": "Paste the conversation URL that you know generated this request. Links are added manually, not provided by the app.",
  "Link cuộc trò chuyện": "Conversation URL",
  "Lưu liên kết": "Save link",
  "Bỏ gắn": "Unlink",
  "Thu gọn": "Collapse",
  "Chi tiết / Chat": "Details / Chat",
  "Không có kết quả phù hợp": "No matching results",
  "Chưa có request nào": "No requests yet",
  "Hãy thử từ khóa hoặc bộ lọc khác.": "Try another search or filter.",
  "Gửi thao tác từ ChatGPT hoặc Gemini và nhấn Làm mới để xem.": "Run an action in ChatGPT or Gemini and select Refresh.",
  "Vui lòng dán link cuộc trò chuyện trước khi lưu.": "Paste a conversation URL before saving.",
  "Không thể lưu liên kết.": "Could not save the link.",
  "Không thể bỏ gắn.": "Could not remove the link.",
  "Đã sao chép mã request": "Request ID copied",
  "Không thể sao chép tự động. Hãy chọn và sao chép ID trong chi tiết.": "Automatic copy failed. Select and copy the ID from the request details.",
  "Không sao chép được": "Copy failed",
  "Xóa toàn bộ lịch sử request local và các link chat đã gắn? Không thể hoàn tác.": "Delete all local request history and linked chat URLs? This cannot be undone.",
  "Xóa lịch sử không thành công.": "Could not clear history.",
  "Đã sao chép": "Copied",
  "Không có dữ liệu endpoint": "Endpoint unavailable",
  "Không thể đọc danh sách skill": "Could not load skills",
  "Dữ liệu skill không hợp lệ.": "Invalid skill data.",
  "Đang bật": "Enabled",
  "Đang tắt": "Disabled",
  "Chưa cài": "Not installed",
  "Tự nhận diện từ Codex": "Discovered from Codex",
  "Chưa tìm thấy SKILL.md trên máy này.": "No SKILL.md found on this computer.",
  "Xem hướng dẫn": "View instructions",
  "Tắt": "Disable",
  "Bật": "Enable",
  "Cài skill vào Codex để sử dụng": "Install this skill in Codex to use it",
  "Chưa có skill nào. Hãy thêm một thư mục SKILL.md.": "No skills found. Add a folder containing SKILL.md.",
  "Không thể lưu thay đổi skill.": "Could not save skill settings.",
  "Không đọc được SKILL.md.": "Could not read SKILL.md.",
  "Đã cập nhật trạng thái skill": "Updated skill state:",
  "Bỏ gắn skill": "Unlink skill",
  "File SKILL.md gốc sẽ không bị xóa.": "The original SKILL.md will not be deleted.",
  "Đã bỏ gắn": "Unlinked",
  "File nguồn vẫn nguyên vẹn.": "The source files remain unchanged.",
  "Đã thêm skill vào UmiBridge. Skill gốc vẫn nằm tại thư mục của bạn.": "Skill added to UmiBridge. Original files remain in their folder.",
  "Đang tải...": "Loading...",
  "Không thể lưu thay đổi": "Could not save changes",
  "Không có dữ liệu": "No data",
  "Không thể tải dữ liệu": "Could not load data",
  "Không thể đọc danh sách skill (": "Could not load skills (",
  "không có kết quả": "no results",
  "UmiBridge Sakura Console: bảng điều khiển local phong cách anime, giám sát request MCP và quản lý liên kết ChatGPT/Gemini.": "UmiBridge Sakura Console: a private anime-inspired local dashboard for MCP activity and ChatGPT/Gemini links."
};
  const EXTRA_EN_TO_VI = {
    'Welcome back,': 'Chào mừng trở lại,',
    'My command center': 'Trung tâm điều khiển của tôi',
    'My private space ✿': 'Không gian riêng tư ✿',
    'LOCAL ONLY': 'CHỈ TRÊN MÁY NÀY',
    'Dashboard': 'Bảng điều khiển',
    'Skill Center': 'Trung tâm kỹ năng',
    'Settings': 'Cài đặt',
    'Appearance': 'Giao diện',
    'Live updates': 'Cập nhật trực tiếp',
    'Gateway status': 'Trạng thái gateway',
    'Maintenance': 'Bảo trì',
    'Preferences': 'TÙY CHỈNH',
    'Control the local dashboard without touching the gateway credentials or request data.':'Điều khiển dashboard local mà không đụng tới credential gateway hay dữ liệu request.',
    'Choose the presentation that is easiest to read on this computer.':'Chọn giao diện dễ đọc nhất trên máy này.',
    'Light, dark, or follow Windows.':'Sáng, tối hoặc theo Windows.',
    'Theme':'Giao diện',
    'Language':'Ngôn ngữ',
    'Dashboard labels only. Tool payloads stay unchanged.':'Chỉ đổi nhãn dashboard. Payload công cụ giữ nguyên.',
    'Automatic refresh':'Tự động cập nhật',
    'Refresh the request history while ChatGPT or Gemini is using the bridge.':'Cập nhật lịch sử request khi ChatGPT hoặc Gemini đang dùng bridge.',
    'Keep the dashboard current without opening a terminal.':'Giữ dashboard mới mà không mở terminal.',
    'Refresh interval':'Chu kỳ cập nhật',
    'Used only when automatic refresh is enabled.':'Chỉ dùng khi bật tự động cập nhật.',
    'The dashboard is loopback-only. ChatGPT and Gemini use the same gateway and tool set.':'Dashboard chỉ chạy loopback. ChatGPT và Gemini dùng chung gateway và bộ công cụ.',
    'Connection':'Kết nối',
    'Connected':'Đã kết nối',
    'Current local health check.':'Kiểm tra sức khỏe local hiện tại.',
    'Runtime mode':'Chế độ chạy',
    'Public tunnel details are never shown here.':'Thông tin tunnel công khai không hiển thị ở đây.',
    'Shared gateway':'Gateway dùng chung',
    'Shared tunnel':'Tunnel dùng chung',
    'Local only':'Chỉ local',
    'Open request history':'Mở lịch sử request',
    'Every 10 seconds':'Mỗi 10 giây',
    'Every 20 seconds':'Mỗi 20 giây',
    'Every 30 seconds':'Mỗi 30 giây',
    'Every 60 seconds':'Mỗi 60 giây',
    'Reset dashboard preferences':'Đặt lại tùy chỉnh dashboard',
    'Keep the local workspace tidy and review command output in one place.':'Giữ workspace local gọn gàng và xem output lệnh tại một nơi.',
    'Credentials, tunnel files, command history, and tool payloads remain in the protected':'Credential, file tunnel, lịch sử lệnh và payload công cụ vẫn nằm trong vùng bảo vệ',
    'Resetting preferences does not delete them.':'Đặt lại tùy chỉnh không xóa các dữ liệu đó.',
    'SAKURA CONSOLE': 'BẢNG ĐIỀU KHIỂN SAKURA',
    'YOUR PERSONAL MCP SPACE': 'KHÔNG GIAN MCP CỦA BẠN',
    '✦ YOUR PERSONAL MCP SPACE': '✦ KHÔNG GIAN MCP CỦA BẠN',
    '✦ UMI / LIVE STATUS': '✦ UMI / TRẠNG THÁI TRỰC TIẾP',
    '✦ UMI / MY TOOLKIT': '✦ UMI / BỘ CÔNG CỤ CỦA TÔI',
    'UMI / WORKSPACE': 'UMI / KHÔNG GIAN LÀM VIỆC',
    'My private space ✿': 'Không gian riêng tư ✿',
    'Private local workspace': 'Không gian riêng tư trên máy',
    'Sakura Console · Private local workspace': 'Sakura Console · Không gian riêng tư trên máy',
    'UmiBridge ✿ Sakura Console · Private local workspace': 'UmiBridge ✿ Sakura Console · Không gian riêng tư trên máy',
    'Chat / Details':'Chat / Chi tiết',
    'Search, inspect, and manually associate chat links and IDs with requests. PowerShell commands run hidden; command output appears in each request detail.':'Tìm kiếm, mở chi tiết, gắn link và ID chat vào từng yêu cầu. Lệnh PowerShell chạy ẩn; command và output xuất hiện trong chi tiết request.',
    'Commands and bounded output stay local with basic secret and path redaction.':'Lệnh và output giới hạn chỉ lưu trên máy, có che cơ bản secret và đường dẫn.',
    'PowerShell command':'Lệnh PowerShell',
    'Working directory:':'Thư mục chạy:',
    'No stdout or output was not captured for this older request.':'Không có stdout hoặc request cũ chưa lưu output.',
    'No stderr.':'Không có stderr.',
    '— tools': '— công cụ',
    '0 requests': '0 yêu cầu',
    'Unable to load local skills.': 'Không đọc được danh sách skill local.',
    'Request is no longer in local history.': 'Request không còn trong lịch sử.',
    'Provide a valid ChatGPT or Gemini conversation URL.': 'Hãy nhập link cuộc trò chuyện ChatGPT hoặc Gemini hợp lệ.',
    'Use a full ChatGPT or Gemini HTTPS URL.': 'Hãy dùng URL HTTPS ChatGPT hoặc Gemini đầy đủ.',
    'Only HTTPS links from chatgpt.com, chat.openai.com or gemini.google.com are accepted, without query parameters.': 'Chỉ chấp nhận link HTTPS của chatgpt.com, chat.openai.com hoặc gemini.google.com, không có tham số.',
    'The URL must point to a ChatGPT conversation (/c/...), Gemini conversation (/app/...) or shared chat (/share/...).': 'Link phải dẫn tới cuộc trò chuyện ChatGPT (/c/...), Gemini (/app/...) hoặc chat chia sẻ (/share/...).',
    'Unknown app': 'Ứng dụng không rõ',
    'Invalid request ID.': 'Mã request không hợp lệ.',
    'Invalid skill name.': 'Tên skill không hợp lệ.',
    'A skill must be a directory.': 'Skill phải là thư mục.',
    'SKILL.md must be a regular file, not a symlink, and no larger than 128 KiB.': 'SKILL.md phải là tệp thông thường, không phải symlink và không vượt 128 KiB.',
    'stateDir must be an absolute path.': 'stateDir phải là đường dẫn tuyệt đối.',
    'Invalid skill registry file.': 'Tệp cấu hình skill không hợp lệ.',
    'Skill not found. Install it in your Codex skills folder or add it through Skill Center.': 'Không tìm thấy skill. Cài skill trong Codex hoặc thêm qua Skill Center.',
    'Skill is disabled. Enable it in Skill Center before reading.': 'Skill đang tắt. Hãy bật trong Skill Center trước khi đọc.',
    'Enter the absolute path to a folder containing SKILL.md.': 'Nhập đường dẫn tuyệt đối tới thư mục chứa SKILL.md.',
    'This skill is already listed. Enable it from Skill Center.': 'Skill đã có trong danh sách. Hãy bật từ Skill Center.',
    'enabled must be a boolean.': 'enabled phải là giá trị boolean.',
    'Skill does not exist.': 'Skill không tồn tại.',
    'Only manually added skills can be unlinked.': 'Chỉ có thể bỏ gắn skill đã thêm thủ công.',
    'Invalid or expired authorization request. Please reconnect.': 'Yêu cầu đã hết hạn hoặc không hợp lệ. Vui lòng kết nối lại.',
    'Too many incorrect attempts. Please retry after 15 minutes.': 'Nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.'
  };
  const TO_EN = Object.freeze(VI_TO_EN);
  const TO_VI = Object.freeze({ ...Object.fromEntries(Object.entries(VI_TO_EN).map(([vi,en]) => [en,vi])), ...EXTRA_EN_TO_VI });
  const originals = new WeakMap();
  const originalAttributes = new WeakMap();
  const ignored = 'script,style,pre,code,textarea,.tool-name,.time,.detail-code,.detail-meta code,.endpoint-info code,.chat-row strong';
  let language = 'en';
  try { language = localStorage.getItem('umibridge.admin.language') === 'vi' ? 'vi' : 'en'; } catch {}
  const patterns = [
    [/^(\d+) giờ (\d+) phút$/, (m,h,n,l)=>l==='en' ? h+'h '+n+'m':m],
    [/^(\d+) phút$/, (m,n,l)=>l==='en' ? n+' min':m],
    [/^(\d+) min$/, (m,n,l)=>l==='vi' ? n+' phút':m],
    [/^(\d+) sec$/, (m,n,l)=>l==='vi' ? n+' giây':m],
    [/^(\d+)h (\d+)m$/, (m,h,n,l)=>l==='vi' ? h+' giờ '+n+' phút':m],
    [/^(\d+) calls · (\d+) errors$/, (m,a,b,l)=>l==='vi' ? a+' lượt · '+b+' lỗi':m],
    [/^(\d+) chats · (\d+) requests$/, (m,a,b,l)=>l==='vi' ? a+' chat · '+b+' request':m],
    [/^(\d+) linked requests( · Shared link)?$/, (m,a,b,l)=>l==='vi' ? a+' request được gắn'+(b?' · Link chia sẻ':''):m],
    [/^(\d+) enabled \/ (\d+) installed$/, (m,a,b,l)=>l==='vi' ? a+' đang bật / '+b+' đã cài':m],
    [/^(\d+) tools$/, (m,n,l)=>l==='vi' ? n+' công cụ':m],
    [/^(\d+) requests$/, (m,n,l)=>l==='vi' ? n+' yêu cầu':m],
    [/^(\d+) \/ (\d+) requests$/, (m,a,b,l)=>l==='vi' ? a+' / '+b+' yêu cầu':m],
    [/^Load (\d+) more requests$/, (m,n,l)=>l==='vi' ? 'Xem thêm '+n+' yêu cầu':m],
    [/^Updated at (.*)$/, (m,a,l)=>l==='vi' ? 'Cập nhật lúc '+a:m],
    [/^Dashboard error: (.*)$/, (m,a,l)=>l==='vi' ? 'Lỗi tải dashboard: '+a:m],
    [/^Success rate: (.*)$/, (m,a,l)=>l==='vi' ? 'Tỉ lệ thành công: '+a:m],
    [/^Error rate: (.*)$/, (m,a,l)=>l==='vi' ? 'Tỉ lệ lỗi: '+a:m],
    [/^Updated skill state: (.*)$/, (m,a,l)=>l==='vi' ? 'Đã cập nhật trạng thái skill '+a:m],
    [/^Unlinked (.*)$/, (m,a,l)=>l==='vi' ? 'Đã bỏ gắn '+a:m],

    [/^(\d+) giây$/, (m,n,l)=>l==='en' ? n+' sec':m],
    [/^(\d+) lượt · (\d+) lỗi$/, (m,a,b,l)=>l==='en' ? a+' calls · '+b+' errors':m],
    [/^(\d+) chat · (\d+) request$/, (m,a,b,l)=>l==='en' ? a+' chats · '+b+' requests':m],
    [/^(\d+) request được gắn( · Link chia sẻ)?$/, (m,a,b,l)=>l==='en' ? a+' linked requests'+(b?' · Shared link':''):m],
    [/^(\d+) yêu cầu$/, (m,n,l)=>l==='en' ? n+' requests':m],
    [/^(\d+) \/ (\d+) yêu cầu$/, (m,n,t,l)=>l==='en' ? n+' / '+t+' requests':m],
    [/^(\d+) đang bật \/ (\d+) đã cài$/, (m,n,t,l)=>l==='en' ? n+' enabled / '+t+' installed':m],
    [/^(\d+) công cụ$/, (m,n,l)=>l==='en' ? n+' tools':m],
    [/^Xem thêm (\d+) yêu cầu$/, (m,n,l)=>l==='en' ? 'Load '+n+' more requests':m],
    [/^P95: (.*)$/, (m,value,l)=>l==='en'?'P95: '+value:m],
    [/^Tỉ lệ thành công: (.*)$/, (m,value,l)=>l==='en'?'Success rate: '+value:m],
    [/^Tỉ lệ lỗi: (.*)$/, (m,value,l)=>l==='en'?'Error rate: '+value:m],
    [/^Cập nhật lúc (.*)$/, (m,value,l)=>l==='en'?'Updated at '+value:m],
    [/^Đã cập nhật trạng thái skill (.*)$/, (m,value,l)=>l==='en'?'Updated skill state: '+value:m],
    [/^Đã bỏ gắn (.*)$/, (m,value,l)=>l==='en'?'Unlinked '+value:m],
    [/^Lỗi tải dashboard: (.*)$/, (m,value,l)=>l==='en'?'Dashboard error: '+value:m],
    [/^API local không phản hồi đầy đủ (.*)$/, (m,value,l)=>l==='en'?'Local API did not respond fully '+value:m]
  ];
  const translate = (value, target) => {
    const str = String(value);
    const trimmed = str.trim();
    if (!trimmed) return str;
    const dict = target === 'vi' ? TO_VI : TO_EN;
    let rendered = dict[trimmed];
    if (rendered == null) {
      for (const [reg, fn] of patterns) {
        const match = trimmed.match(reg);
        if (match) { rendered = fn(...match, target); break; }
      }
    }
    if (rendered == null) return str;
    return str.replace(trimmed, rendered);
  };
  const ignoreNode = (node) => {
    const parent = node.nodeType === 3 ? node.parentElement : node;
    return !parent || parent.closest(ignored) !== null;
  };
  const visitText = node => {
    if (ignoreNode(node)) return;
    if (!originals.has(node)) originals.set(node, node.nodeValue);
    const baseline = originals.get(node);
    const next = translate(baseline,language);
    if (node.nodeValue !== next) node.nodeValue = next;
  };
  const visitAttrs = element => {
    if (element.matches(ignored)) return;
    let orig = originalAttributes.get(element);
    if (!orig) { orig = {}; originalAttributes.set(element,orig); }
    for (const key of ['placeholder','aria-label','title','content']) {
      if (!element.hasAttribute(key)) continue;
      if (!(key in orig)) orig[key] = element.getAttribute(key);
      const next = translate(orig[key],language);
      if (element.getAttribute(key) !== next) element.setAttribute(key,next);
    }
  };
  const traverse = node => {
    if (node.nodeType === 3) { visitText(node); return; }
    if (node.nodeType !== 1) return;
    visitAttrs(node);
    if (node.matches(ignored)) return;
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    while(walker.nextNode()) {
      const item=walker.currentNode;
      if(item.nodeType===3) visitText(item);
      else visitAttrs(item);
    }
  };
  const apply = () => {
    document.documentElement.lang = language;
    const input=document.getElementById('languageSelect');
    if(input) { input.value=language; input.setAttribute('aria-label', language==='en'?'Interface language':'Ngôn ngữ giao diện'); }
    traverse(document.body);
  };
  const observer=new MutationObserver(records => {
    for (const record of records) {
      if (record.type==='characterData') visitText(record.target);
      else for (const node of record.addedNodes) traverse(node);
    }
  });
  observer.observe(document.body,{subtree:true,childList:true,characterData:true});
  const input=document.getElementById('languageSelect');
  if(input) input.addEventListener('change',()=>{
    language = input.value==='vi'?'vi':'en';
    try{localStorage.setItem('umibridge.admin.language', language);}catch{}
    apply();
  });
  apply();
})();
