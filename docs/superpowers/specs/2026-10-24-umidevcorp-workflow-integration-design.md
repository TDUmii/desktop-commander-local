# UmiDevCorp Workflow Integration Design

## Intent

Đưa cách quản trị workflow của UmiDevCorp vào UmiBridge để người dùng theo dõi project, task, handoff và hoạt động trong cùng dashboard hiện tại. UmiBridge vẫn là gateway thực thi duy nhất; UmiDevCorp chỉ cung cấp mô hình quản trị được tham khảo.

## Goals

- Gắn mỗi request UmiBridge với một workflow task bền vững, có project/chat, role, trạng thái và timeline.
- Hỗ trợ các trạng thái `queued`, `running`, `waiting`, `review`, `done`, `blocked` và `archived`.
- Lưu `parent_id`, `next_role`, `next_task`, `hop` và `baseline_hash` để theo dõi handoff và khôi phục sau restart.
- Chống gửi trùng bằng `workflow_id` và `dispatch_key`; khôi phục chỉ đọc trạng thái cuối, không tự gửi lại prompt.
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

Mỗi record có: `workflow_id`, `project_key`, `chat_key`, `title`, `role`, `status`, `request_id`, `job_id`, `parent_id`, `next_role`, `next_task`, `hop`, `baseline_hash`, `created_at`, `updated_at`, `blocked_reason` và `events` tham chiếu. `dispatch_key` được băm từ workflow và request để idempotency, không lưu prompt bí mật trong khóa.

### Status mapping

`QUEUED` map vào `queued`, `DISPATCHED` vào `running`, `WAITING` vào `waiting`, `COMPLETED` vào `done`, `REVIEW` vào `review`, `BLOCKED` vào `blocked`, và `DONE` vào `archived`. Trạng thái workflow tách khỏi trạng thái device/job để không phá API MCP hiện tại.

### API and UI

- `GET /admin/api/workflows` lọc theo project, chat, status và thời gian.
- `POST /admin/api/workflows` tạo task thủ công hoặc từ request đã có.
- `PATCH /admin/api/workflows/:id` chỉ cho phép chuyển trạng thái hợp lệ, pause/resume và cập nhật handoff metadata.
- `GET /admin/api/workflows/:id/events` trả timeline đã lọc.
- `POST /admin/api/workflows/export` và `/import` dùng schema version, giới hạn kích thước và loại bỏ dữ liệu riêng.

Dashboard thêm một mục Workflows với bộ lọc ngắn, cột trạng thái, project/chat, role, lần cập nhật và nút mở chi tiết. Chi tiết hiển thị timeline, job/request liên kết, lý do blocked và handoff tiếp theo; không tự gửi lệnh.

## Validation

- Contract tests cho chuyển trạng thái hợp lệ/không hợp lệ, idempotency và restart recovery.
- Test project/chat key validation, baseline mismatch, import/export redaction và giới hạn kích thước.
- API tests kiểm tra action guard và bảo toàn Admin/Normal privilege routes.
- UI tests kiểm tra Workflows không làm thay đổi Requests/Devices/Settings và không tự dispatch.
- Build, full regression, privacy scan, source ZIP inspection và actual local dashboard check trước commit/release.

## Rollback

Tắt tính năng bằng feature flag mặc định `false` hoặc xóa workflow store mới; request history, job store, OAuth, tool/skill policy và privilege state không bị sửa. Nếu migration lỗi, gateway tiếp tục khởi động với Workflows unavailable và hiển thị lỗi cục bộ.

## Accepted decisions

- **State machine:** dùng các trạng thái `queued`, `running`, `waiting`, `paused`, `review`, `blocked`, `done`, `archived` và `cancelled`. Luồng hợp lệ là `queued -> running -> waiting/review/blocked/paused -> running` hoặc `done`; `done -> archived`; `cancelled` là kết thúc. `paused` chỉ do thao tác thủ công và resume không tự dispatch.
- **Binding:** một workflow đại diện cho một yêu cầu công việc cấp người dùng, không phải từng MCP tool-call. Một workflow có thể tham chiếu nhiều `request_id`, nhưng chỉ có tối đa một `job_id` active. Job/device status vẫn được giữ riêng.
- **Dispatch:** chỉ dispatch qua nút/API thủ công. `dispatch_key` được tính từ workflow và payload chuẩn hóa; key trùng trả bản ghi hiện có. Ghi record và tạo lease dispatch theo thứ tự idempotent, nếu gateway dừng giữa chừng thì trạng thái về `waiting` và không tự gửi lại.
- **Restart:** job đang chạy mà bị mất khi gateway restart chuyển thành `waiting` với lý do `gateway_restart`; người dùng phải bấm resume/dispatch. `baseline_hash` băm metadata an toàn của task trước dispatch, không băm secret hoặc raw prompt.
- **Permissions:** đọc dùng loopback/local-admin hiện tại; tạo, sửa, pause/resume, dispatch, import/export đều yêu cầu `x-dc-admin-action` và CSRF guard. Không yêu cầu Administrator mode, nhưng không được hạ ACL của các route privilege.
- **Project/chat identity:** dùng `project_key` và `chat_key` opaque đã lọc từ workspace/chat links hiện có. Không thêm raw URL vào ledger; đổi tên chỉ đổi nhãn hiển thị, không đổi khóa.
- **Storage:** JSONL append-only cho record/event, index memory khi gateway chạy, `schema_version`, event ID tăng dần, giới hạn kích thước, optimistic `version`, lock ghi và phục hồi partial line. Không thêm SQLite runtime.
- **Feature flag:** `UMIBRIDGE_WORKFLOWS=0` là mặc định; khi tắt, API trả trạng thái unavailable và UI ẩn khu vực Workflows. Bật chỉ qua local settings/action guard, không tự bật sau restart.
- **Automation:** mọi automation/watchdog từ UmiDevCorp vẫn tắt; pause/resume và dispatch là thao tác người dùng.

## Implementation status

The approved adapter is implemented in `scripts/workflow-ledger.mjs` and is opened by the existing Node gateway only when `UMIBRIDGE_WORKFLOWS=1` (or an explicit test option). The JSONL store is append-only with bounded records, optimistic versions, event IDs, redacted export/import, safe partial-tail recovery, and `running -> waiting` restart recovery. The local-admin routes and dashboard remain manual-only; no workflow is created from an MCP tool call and no route dispatches a job automatically. Contract, gateway, UI, syntax, and existing gateway regression tests are kept in the Node built-in test suite.
