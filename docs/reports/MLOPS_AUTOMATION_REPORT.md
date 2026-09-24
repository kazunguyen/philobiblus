# Báo cáo hoàn thiện MLOps Automation

## Trạng thái thực tế

Hạ tầng MLOps đã được apply thật vào project GCP `grace-enhanced`, GKE
`philobiblus-dev-gke`, ngày 24-09-2026. Terraform đã tạo bucket private,
versioned `grace-enhanced-philobiblus-mlops`, hai GSA Workload Identity và IAM
theo prefix. Helm release `philobiblus-mlops` hiện deployed; MLflow healthy,
CronJob `philobiblus-retrain` chạy hằng ngày lúc `20:00 UTC` và không suspend.

Job xác minh đã train từ catalog public thật (100 sách), ghi snapshot immutable
lên GCS, tạo MLflow experiment/run và đăng ký version `1` của
`philobiblus-content-recommender`. Candidate bị chặn ở quality gate
`insufficient_data` do chưa có profile tương tác đủ điều kiện; model serving
hiện tại vì thế không bị thay đổi.

## Những gì đã được triển khai trong mã nguồn

1. Sparse recommender v2

   - Artifact chỉ lưu `feature_matrix` sparse; service xếp hạng on-demand,
     không tạo dense `N x N` matrix.
   - Diagnostic khi train lấy mẫu cố định, nên bị chặn ở
     `O(sample_size * catalog_size)` thay vì `O(N²)`.
   - InitContainer `model-fetcher` tải artifact từ GCS, kiểm tra SHA-256 và
     schema v2 trước khi atomically publish file cho service.

2. Pipeline retrain và quality gate

   - `snapshot_catalog.py` query đúng tập `visibility='public'`, export Parquet
     dưới repeatable-read và hash theo dữ liệu logic. Cùng catalog tạo cùng
     `snapshot_id`, nên upload GCS idempotent.
   - `validate_snapshot.py` kiểm schema, ID, title/author, tags, catalog-drop
     và xuất `new_books`, `updated_books`, `removed_books` so với champion.
   - Pipeline tải release champion hiện hành, skip catalog không đổi khi
     champion còn trong thời hạn, rồi chạy prepare → train → time-based holdout
     evaluation → MLflow → promotion.
   - Candidate được đăng ký vào MLflow Model Registry; chỉ status `passed`
     (đủ cohort, hit-rate/coverage tối thiểu, không regression vượt ngưỡng)
     mới được promote.

3. Release và rollback

   - Promotion ghi model và manifest immutable với generation precondition,
     cập nhật `model-release` ConfigMap bằng resource version, patch annotation
     Deployment và kiểm cả rollout lẫn `/health.model_version`.
   - Khi rollout lỗi, release pointer và Deployment annotation được rollback;
     MLflow run bị đánh dấu `rolled_back`. Alias `candidate` và `champion` chỉ
     được gán sau rollout thành công.
   - Lần bootstrap đầu tiên cần một release known-good và phải bật rõ
     `trainer.allowBootstrap`; CronJob mặc định `suspend: true` để không tự ý
     thay model production.

4. Kubernetes, secrets và IAM

   - Chart `philobiblus-mlops` có MLflow, Cloud SQL Auth Proxy native sidecar,
     CronJob `Forbid`, deadline/TTL, resource limits, non-root và minimal RBAC
     chỉ patch Deployment/ConfigMap trong namespace ứng dụng.
   - URI DB đọc từ Secret Manager CSI (`secretSync.enabled=true`) hoặc từ một
     Kubernetes Secret đã tạo ngoài chart; không có password trong values hay
     Terraform state.
   - Terraform tạo bucket versioned/private, schema PostgreSQL `mlflow` trong
     database ứng dụng hiện hữu, GSA, Workload
     Identity, Cloud SQL client và IAM GCS theo prefix `snapshots/`, `models/`,
     `releases/`, `mlflow/`. Runtime recommender chỉ có `objectViewer` với
     prefix `models/`.
   - Terraform app đã annotate KSA recommender bằng Workload Identity; image
     `model_fetcher_image` bắt buộc là digest immutable.

5. CI/CD

   - CI chạy backend/ML tests, parse Python, DVC dry-run, Helm lint/template,
     Terraform fmt/validate và build ba image trainer/fetcher/MLflow.
   - CD là `workflow_dispatch` trong protected environment, OIDC GitHub → GCP,
     push image theo commit SHA, resolve digest, Terraform apply và Helm deploy.
     Nó không còn placeholder hoặc `docker push` giả. Không có auto-apply trên
     push vào `main`.

## Kiểm chứng đã chạy

- Build `ml/training/Dockerfile` thành công sau khi thêm `ml/.dockerignore`.
- Parse 12 Python source file trong image; kiểm tra hash snapshot, catalog delta,
  quality gate và sparse profile ranking đều pass.
- `helm template` pass cho chart app, chart MLOps và nhánh Secret Manager CSI.
- `terraform init -backend=false` và `terraform validate` pass cho
  `infrastructure/terraform/gke-mlops`.
- Apply Terraform remote-state hoàn tất (bucket, hai GSA, Workload Identity,
  Cloud SQL Client, Secret Manager và IAM GCS theo prefix).
- Helm release revision 9 deployed; MLflow health probe pass với một worker và
  request/limit memory lần lượt 1Gi/2Gi.
- Job `philobiblus-retrain-verify5-20260924092030` completed: snapshot →
  validate → prepare → train → evaluate → MLflow registry → quality gate.

## Cách xác minh retrain với dữ liệu mới

1. Thêm hoặc cập nhật một sách `visibility='public'` qua API/UI bình thường;
   không sửa trực tiếp DB production.
2. Không cần chờ lịch: tạo một Job từ CronJob đang chạy (`kubectl create job
   --from=cronjob/philobiblus-retrain <ten-job>`), rồi xem log trainer.
3. Xác nhận `snapshot_id` hoặc `sha256` trong log thay đổi và có object mới tại
   `gs://grace-enhanced-philobiblus-mlops/snapshots/`.
4. Xác nhận MLflow có run/version mới. Nếu `validation_status=passed`, job sẽ
   ghi `pending_bootstrap` cho lần đầu thay vì tự đổi serving model. Bệ hạ duyệt
   candidate đó rồi mới chạy bootstrap rõ ràng với `--allow-bootstrap`.
5. Sau bootstrap thành công, các lần chạy lịch tiếp theo chỉ promote candidate
   pass quality gate và rollout/recommendation health check đều thành công.
