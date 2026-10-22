# Tự đánh giá và chỉnh UI - 22/10/2026

Phạm vi: dashboard local, ưu tiên theo dõi lệnh, phân tích token và kết nối dùng lại. Đánh giá dưới đây là nhận định thiết kế nội bộ theo tiêu chí sử dụng, không phải kết quả khảo sát người dùng hoặc thang điểm tự động.

| Tiêu chí | Trước | Sau chỉnh |
| --- | ---: | ---: |
| Phân cấp và ưu tiên thông tin | 6 | 8,5 |
| Chữ và độ dễ đọc | 6 | 8,5 |
| Điều hướng và thao tác | 7 | 8,5 |
| Nhất quán giữa các mục | 7 | 8 |
| Dùng trên màn hình nhỏ | 6,5 | 8 |
| Trung bình / 10 | **6,5** | **8,3** |

## Các vấn đề đã chỉnh

- Bỏ lời chào cá nhân cố định và giảm phần banner trang trí; Tổng quan đưa trạng thái và lối đi đến lịch sử, token, kết nối lên trước.
- Giữ sắc tím Sakura nhưng giảm gradient, bóng sáng và họa tiết. Tăng chữ phụ và độ tương phản, thống nhất tiêu đề và khoảng cách.
- Đưa kết nối và sao chép mã lên đầu Cài đặt, cả trong bố cục lẫn thứ tự bàn phím. Giao diện, tự cập nhật và bảo trì nằm sau.
- Làm mới và thông báo lỗi có hiệu lực ở mọi mục. Người dùng xem Phân tích không phải quay về Tổng quan để phục hồi sau lỗi tải dữ liệu.
- Dùng bộ chọn mục có nhãn trên màn hình nhỏ, giữ đủ bảy mục thay vì giấu các mục cuối trong thanh cuộn ngang.
- Giữ tiếng Việt/Anh, theme sáng/tối, lịch sử lệnh và nhãn token ước tính. Không thay đổi quyền OAuth hoặc tunnel.

## Giới hạn đánh giá

Chưa thực hiện khảo sát người dùng hay kiểm thử bằng trình đọc màn hình thật. Bộ phát hiện thiết kế đang chạy chế độ regex vì thiếu parser, nên không dùng kết quả của nó để kết luận đạt toàn bộ tiêu chuẩn accessibility. Bảng mã/lệnh dài vẫn cần cuộn trong vùng nội dung tương ứng.
