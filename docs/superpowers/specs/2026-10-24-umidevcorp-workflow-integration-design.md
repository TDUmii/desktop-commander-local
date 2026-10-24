# UmiDevCorp Workflow Integration Design

## Intent

Đưa cách quản trị workflow của UmiDevCorp vào UmiBridge để người dùng theo dõi project, task, handoff và hoạt động trong cùng dashboard hiện tại. UmiBridge vẫn là gateway thực thi duy nhất; UmiDevCorp chỉ cung cấp mô hình quản trị được tham khảo.

## Goals

- Gắn các request được người dùng chọn với một workflow task bền vững, có project/chat, role, trạng thái và timeline. Không tự tạo workflow cho từng tool-call.
- Hỗ trợ các trạng thái `queued`, `running`, `waiting`, `paused`, `review`, `done`, `blocked`, `archived` và `cancelled`.
- Lưu `parent_id`, `next_role`, `next_task`, `hop` và `baseline_hash` để theo dõi handoff và khôi phục sau restart.
- Chống liên kết job trùng bằng `workflow_id` và `dispatch_key`; khôi phục không tự gửi lại prompt. Khóa này không chống thực thi lại khi người dùng gọi MCP thêm lần nữa.
- Thêm khu vực Workflows trong dashboard, liên kết sang Requests, Chats, Devices và Activity.
- Giữ auto-check, auto-dispatch và watchdog ở trạng thái tắt. Pause/resume chỉ do người dùng bấm.
- Cho phép export/import JSON đã lọc để sao lưu cấu trúc workflow mà không đưa dữ liệu riêng ra ngoài.

## Non-goals

- Không chạy Python, PySide6, `autopilot.py` hoặc `watchdog.ps1` trong UmiBridge.
- Không sao chép `devcorp.db`, `.umidevcorp`, cookies, browser state, runtime, screenshot, log hay URL riêng.
- Không thay đổi MCP job status, quyền Admin/Normal, OAuth, tunnel, tool policy hoặc skill registry hiện có.
- Không tự động mở chat, gửi prompt hoặc khởi động lại gateway.

## Constraints

- State mới nằm trong `.local-data` và phải tuân theo quyền/loại trừ hiện có.
- Request/result hiển thị phải đi qua bộ lọc hiện tại của `local-admin.mjs`; không ghi token, secret, cookie, private URL hoặc full command output ngoài cơ chế hiện có.
- Admin API giữ loopback/local-admin và header hành động hiện tại; route ghi dữ liệu phải có CSRF/action guard.
- Dữ liệu workflow không được nằm trong source ZIP hoặc Git khi chứa runtime/private state.
- Tương thích Windows và launcher một file `UmiBridge.cmd` phải được giữ nguyên.

## Approach

Tạo một adapter quản trị gọn trong UmiBridge thay vì đưa UmiDevCorp vào như sidecar. Adapter dùng store JSONL/JSON cùng quy ước `.local-data`, liên kết `request_id` và `job_id` hiện có, còn execution vẫn đi qua command session/device relay của UmiBridge. Đây là phương án ít runtime mới nhất và có rollback rõ ràng.

### Workflow record

Mỗi record có: `workflow_id`, `project_key`, `chat_key`, `title`, `role`, `status`, `request_ids`, `job_id`, `parent_id`, `next_role`, `next_task`, `hop`, `baseline_hash`, `version`, `created_at`, `updated_at`, `blocked_reason` và `event_ids` tham chiếu. Một workflow chứa nhiều request nhưng chỉ một job được liên kết. `dispatch_key` là khóa opaque có giới hạn, hoặc được băm từ metadata khi không được truyền; export loại khóa này. Không lưu prompt bí mật trong khóa.

### Status mapping

`QUEUED` map vào `queued`, `DISPATCHED` vào `running`, `WAITING` vào `waiting`, `COMPLETED` vào `done`, `REVIEW` vào `review`, `BLOCKED` vào `blocked`, và `DONE` vào `archived`. Trạng thái workflow tách khỏi trạng thái device/job để không phá API MCP hiện tại.

### API and UI

- `GET /admin/api/workflows` lọc theo project, chat, status và thời gian.
- `POST /admin/api/workflows` tạo task thủ công hoặc từ request đã có.
- `PATCH /admin/api/workflows/:id` chỉ cho phép chuyển trạng thái hợp lệ, pause/resume và cập nhật handoff metadata.
- `GET /admin/api/workflows/:id` trả record và ETag; sửa dùng `version` hoặc `If-Match`, bản cũ trả HTTP 409.
- `POST /admin/api/workflows/:id/link-job` gắn một job đã có bằng form inline. Route không tạo hay gửi job.
- `GET /admin/api/workflows/:id/events` trả timeline đã lọc.
- `POST /admin/api/workflows/export` và `/import` dùng schema version, giới hạn kích thước và loại bỏ dữ liệu riêng.

Dashboard thêm một mục Workflows với bộ lọc ngắn, cột trạng thái, project/chat, role, lần cập nhật và nút mở chi tiết. Chi tiết hiển thị timeline, job/request liên kết, lý do blocked và handoff tiếp theo; không tự gửi lệnh.

## Validation

- Contract tests cho chuyển trạng thái hợp lệ/không hợp lệ, idempotency và restart recovery.
- Test project/chat key validation, baseline SHA-256 metadata, import/export redaction và giới hạn kích thước.
- API tests kiểm tra action guard và bảo toàn Admin/Normal privilege routes.
- UI tests kiểm tra Workflows không làm thay đổi Requests/Devices/Settings và không tự dispatch.
- Build, full regression, privacy scan, source ZIP inspection và actual local dashboard check trước commit/release.

## Rollback

Tắt bằng cách bỏ `UMIBRIDGE_WORKFLOWS=1` và xóa marker `workflows-enabled` trong profile, rồi khởi động lại theo lifecycle Normal/Admin trong README. Giữ journal để có thể bật lại; không cần xóa dữ liệu workflow. Request history, job store, OAuth, tool/skill policy và privilege state không bị sửa. Chỉ bỏ qua đuôi JSONL bị cắt; lỗi journal ở giữa phải được kiểm tra và phục hồi từ bản sao, không coi là khởi động thành công.

## Accepted decisions

- **State machine:** dùng các trạng thái `queued`, `running`, `waiting`, `paused`, `review`, `blocked`, `done`, `archived` và `cancelled`. Luồng hợp lệ là `queued -> running -> waiting/review/blocked/paused -> running` hoặc `done`; `done -> archived`; `cancelled` là kết thúc. `paused` chỉ do thao tác thủ công và resume không tự dispatch.
- **Binding:** một workflow đại diện cho một yêu cầu công việc cấp người dùng, không phải từng MCP tool-call. Một workflow có thể tham chiếu nhiều `request_id`, nhưng chỉ có tối đa một `job_id` active. Job/device status vẫn được giữ riêng.
- **Dispatch:** thực thi lệnh qua MCP/device relay hiện có. Workflows chỉ gắn job thủ công, không có nút/API thực thi mới hay dispatch lease. `dispatch_key` trùng trả liên kết hiện có khi version còn hợp lệ; version cũ trả conflict. Không dùng liên kết này làm bảo đảm chống chạy lại lệnh MCP.
- **Restart:** workflow `running` chuyển thành `waiting` với lý do `gateway_restart`; resume cần thao tác rõ ràng và không thực thi lệnh. Import cũng đổi record `running` thành `waiting` với lý do `import_requires_resume`. `baseline_hash` chỉ nhận SHA-256 metadata an toàn, không secret hoặc raw prompt.
- **Permissions:** đọc dùng loopback/local-admin hiện tại; tạo, sửa, pause/resume, link-job, import/export đều yêu cầu `x-dc-admin-action` và CSRF guard. Không yêu cầu Administrator mode, nhưng không được hạ ACL của các route privilege. Project/chat chỉ nhóm dữ liệu, không phân quyền riêng giữa người dùng chung identity.
- **Project/chat identity:** dùng `project_key` và `chat_key` opaque đã lọc từ workspace/chat links hiện có. Không thêm raw URL vào ledger; đổi tên chỉ đổi nhãn hiển thị, không đổi khóa.
- **Storage:** JSONL append-only cho record/event, index memory khi gateway chạy, `schema_version`, event ID tăng dần, giới hạn kích thước, optimistic `version`, lock ghi và phục hồi partial line. Không thêm SQLite runtime.
- **Feature flag:** tắt mặc định. Bật tạm bằng `UMIBRIDGE_WORKFLOWS=1` hoặc bền vững bằng file rỗng `.local-data/profile/workflows-enabled`. Marker chỉ áp dụng cho profile đó và đi qua lifecycle Normal/Admin cùng journal; không thêm công tắc dashboard. `workflowEnabled: false` tắt rõ ràng kể cả khi có marker hoặc biến môi trường. Khi tắt, API trả HTTP 404 `workflows_disabled`, UI ẩn Workflows và không tạo journal mới.
- **Automation:** mọi automation/watchdog từ UmiDevCorp vẫn tắt; pause/resume và link-job là thao tác người dùng.

## Implementation status

Released in `v0.1.0-beta.22`, runtime commit `a2f08ea859c94f10b78d654bd311caef62679985`. The adapter in `scripts/workflow-ledger.mjs` opens only after environment/profile opt-in or an explicit test option. The JSONL store has bounded records, optimistic versions, event IDs, redacted export/import, partial-tail recovery, serialized writes/imports and `running -> waiting` restart recovery. The native lifecycle copies the journal and profile marker with production state and digest checks. Local-admin routes and dashboard stay manual; no MCP call creates a workflow and linking never dispatches a command.

The released artifact passed 84 Windows regression tests and real Chrome/native acceptance. Post-release closeout checks the actual ChatGPT web connector against the running Administrator gateway and adds simultaneous API-writer coverage. Testing remains on one Windows machine as requested; separate physical machines and per-person authorization isolation are outside this acceptance. See `docs/ACCEPTANCE.vi.md` for current evidence and limitations.
