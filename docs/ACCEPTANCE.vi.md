# Nghiệm thu UmiBridge beta.22

Ngày kiểm tra: 24/10/2026, giờ Việt Nam. Runtime được nghiệm thu là `v0.1.0-beta.22`, commit `a2f08ea859c94f10b78d654bd311caef62679985`. Phần chốt sau phát hành bổ sung tài liệu và test; không đổi runtime hay yêu cầu cài lại bản Administrator.

## Kết quả thực tế

| Luồng | Kết quả và phạm vi |
| --- | --- |
| ChatGPT web tới gateway Administrator | Plugin UmiBridge đã kết nối gọi `run_command` thật; stdout có marker riêng và `ELEVATED=True`, exit code 0, không timeout. Kết quả B hiển thị đầy đủ trên ChatGPT và khớp request journal. |
| stdout và stderr | Lượt A ghi đúng marker stdout và stderr, exit code 0. Câu trả lời web của lượt này không tải được; kết quả gateway vẫn được giữ làm bằng chứng riêng. |
| Hai cuộc trò chuyện dùng chung connector | Gửi hai yêu cầu C/D cùng đợt; mỗi yêu cầu tạo đúng một request, stdout không lẫn marker. C hiển thị trực tiếp; D hiển thị sau yêu cầu đọc lại kết quả đã có, không gọi lại công cụ. |
| Hai Agent CLI cục bộ | Hai process Agent và hai PowerShell worker riêng nhận hai job gửi đồng thời qua OAuth/MCP. Job ID khác nhau, exit code đều 0, mỗi file bằng chứng có đúng marker của Agent đích. Process QA đã dừng sau kiểm tra. |
| Hai phiên ghi workflow đồng thời | Regression API gửi cùng version qua `Promise.all`: một HTTP 200, một HTTP 409 `workflow_version_conflict`; chỉ một update event, không tạo job thực thi. |
| Định tuyến nhiều Agent | Regression gửi đồng thời tới hai device ID, kiểm tra job ID khác nhau và stdout không lẫn. File, quyền Agent và image-forwarding fixture tiếp tục được kiểm tra trong suite hiện có. |
| Bản đang chạy | Health OK; Administrator beta.22; `pending=false`, `needsUpdate=false`. Workflow nghiệm thu trước vẫn `done`, version 5, không thiếu liên kết. |

## Lỗi hiển thị phía web đã quan sát

Trong hai lượt đầu có nhắc plugin trực tiếp, ChatGPT hiển thị `Không thể tải phản hồi này` dù gateway ghi nhận lệnh đã hoàn tất. Chưa xác định được nguyên nhân; browser error log không cung cấp lỗi tương ứng. Không coi đây là lỗi thực thi đã sửa hoặc bảo đảm mọi lượt web đều ổn định.

Nếu gặp trường hợp này, kiểm tra Requests trước khi gửi thêm lệnh. Khi request đã thành công, yêu cầu ChatGPT chỉ đọc lại kết quả đã nhận và không gọi lại công cụ. Lượt D đã kiểm tra cách này: câu trả lời xuất hiện, request count không tăng. Không dùng nút tạo lại hoặc gửi lại thao tác có tác dụng phụ khi chưa biết kết quả lần đầu.

## Phạm vi tài khoản chung và nhiều máy

Người dùng chọn chỉ kiểm tra trên máy hiện tại. Hai Agent CLI dùng process, config và worker riêng nhưng vẫn thuộc cùng một máy Windows. Kết quả này chưa xác nhận đường truyền giữa hai máy vật lý.

Hai cuộc trò chuyện web cùng tài khoản/connector dùng chung quyền. `project_key` và `chat_key` nhóm công việc; chúng không tạo ranh giới phân quyền giữa người dùng. Test xung đột version bảo vệ cập nhật workflow, không thay thế phân quyền từng người. Không thêm tính năng phân quyền hay automation vào đợt chốt này.

## Kiểm tra có thể chạy lại

```powershell
npm run build
npm run local:test
```

Test bổ sung nằm trong `test/workflow-gateway.test.mjs`; định tuyến đồng thời nằm trong `test/multi-device-gateway.test.mjs`. Build và regression phải chạy khi các thao tác cài/chuyển quyền native đã kết thúc, để bộ quan sát console không bắt nhầm cửa sổ của công việc QA khác.

Bản ZIP beta.22 đã phát hành đạt 84/84 test. Đợt chốt bổ sung một regression; build và toàn bộ 85/85 test local đã pass, không fail hoặc skip. CI cho tài liệu/test trên nhánh `main`: [Windows build and regression checks](https://github.com/TDUmii/umi-bridge/actions/workflows/beta-release.yml).

## Bằng chứng và bản phát hành

Bằng chứng riêng nằm trong `.local-data/qa/beta22-closeout-20261024/`: ảnh và nội dung ChatGPT web, request journal được đối chiếu, kết quả hai Agent CLI, log regression và báo cáo QA. Không đưa những file này, URL riêng, tài khoản, token, config Agent hoặc runtime vào Git/source ZIP.

[Latest beta.22](https://github.com/TDUmii/umi-bridge/releases/tag/v0.1.0-beta.22) giữ nguyên runtime đã nghiệm thu. Source ZIP phát hành có 318912 byte, SHA-256:

```text
ac74ec5907a784fbd21f63ac7e21f32e6b9baad360119fba9edd53e5ad3694be
```

Commit tài liệu/test sau phát hành nằm trên `main`; tag và ZIP beta.22 tiếp tục trỏ tới runtime `a2f08ea`. Không đổi tag cũ hoặc thay asset đã kiểm thử chỉ để thêm báo cáo.
