# Admission policy cho Philobiblus

Tài nguyên `philobiblus-production-baseline` kiểm tra Pod tại hai namespace `philobiblus` và `philobiblus-mlops`. Policy khởi đầu ở chế độ `Audit` để thu thập vi phạm của image bên thứ ba, Cloud SQL proxy và các workload hiện hữu mà không làm gián đoạn dịch vụ.

Sau khi tất cả vi phạm được xử lý, chuyển `validationFailureAction` thành `Enforce`. Việc chuyển đổi chỉ được thực hiện sau khi kiểm tra kết quả `PolicyReport` trong cả hai namespace và xác nhận image đã ký bằng Cosign. Policy không tự cài Kyverno CRD/controller; cluster cần được cài đặt Kyverno trước khi apply manifest.

Danh sách kiểm tra trước khi enforce:

- Tất cả image nội bộ dùng digest SHA-256.
- Các sidecar của Google và image bên thứ ba được đánh giá ngoại lệ có thời hạn hoặc thay bằng digest.
- `PolicyReport` không có vi phạm non-root, resource hoặc capability.
- Xác thực provenance của image được áp dụng riêng sau khi định danh GitHub OIDC subject và Artifact Registry repository được chốt.
