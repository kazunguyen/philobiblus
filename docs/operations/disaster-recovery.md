# Backup, phục hồi và DR drill

## Mục tiêu phục hồi

- Cloud SQL: RPO tối đa 24 giờ từ automated backup và giảm thêm bằng PITR; RTO mục tiêu 4 giờ.
- Model release và artifact: lưu trên GCS versioning; RPO 24 giờ; RTO mục tiêu 2 giờ.
- Cấu hình Kubernetes: tái tạo bằng Terraform/Helm và image digest; không coi PVC là bản sao lưu duy nhất.

## Cấu hình bắt buộc

Cloud SQL cần bật automated backup, point-in-time recovery và retention phù hợp. GCS bucket MLOps cần versioning, lifecycle và quyền ghi tối thiểu qua Workload Identity. Secret Manager, Terraform state bucket và registry image phải có retention độc lập với namespace ứng dụng.

## Restore drill không phá hủy

1. Chọn Cloud SQL backup hoặc thời điểm PITR và khôi phục sang instance cô lập, không ghi đè instance đang phục vụ.
2. Khởi tạo namespace `philobiblus-dr`, Secret Manager binding và Helm release từ digest đã ký.
3. Cấp `DATABASE_URL` trỏ tới instance khôi phục, sau đó kiểm tra schema, số bản ghi, `/health`, API public và recommendation model manifest.
4. Tải một artifact version từ GCS, kiểm tra SHA-256 trong `model-release`, sau đó kiểm tra endpoint recommendation.
5. Ghi nhận thời gian, dữ liệu mất tối đa, lỗi phát sinh và cleanup instance/namespace cô lập.

DR drill được thực hiện mỗi quý hoặc sau thay đổi lớn về schema, bucket hoặc quyền IAM. Kết quả drill là điều kiện để duy trì RPO/RTO nêu trên.
