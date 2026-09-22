# Nhật ký thực hành Terraform trên Google Cloud

> Chỉ ghi những bước đã được hướng dẫn và xác nhận thực hiện. Các bước chưa làm sẽ được hướng dẫn trong chat trước, rồi mới bổ sung vào tài liệu này.

## Phạm vi

- Dự án: `your-gcp-project-id`
- Project number: `your-project-number`
- Region: `asia-southeast1`
- Môi trường thao tác: WSL
- Thư mục dự án: `/mnt/d/JUNIOR/SEMESTER2/Thuc-tap/JITS_INNO_Labs/devops-training-NguyenQuangDung/phase-2/track-mlops-security/philobiblus`

## Bước 0 — Kiểm tra công cụ

Đã chạy trong WSL:

```bash
terraform version
gcloud version
docker version
```

Kết quả đã xác nhận:

| Công cụ | Phiên bản | Trạng thái |
| --- | --- | --- |
| Terraform | `1.16.2` trên `linux_amd64` | Dùng được; bản `1.16.3` là patch mới hơn, chưa bắt buộc cập nhật. |
| Google Cloud SDK | `577.0.0` | Dùng được. |
| Docker Engine | `29.6.1` | Client và server đều dùng được. |

Terraform `1.16.2` thỏa điều kiện `>= 1.16.0, < 2.0.0` của cấu hình dự kiến.

## Bước 1 — Xác thực Google Cloud và chọn project

Đã đăng nhập Google Cloud và tạo Application Default Credentials (ADC). Xác thực ADC đã được kiểm tra bằng:

```bash
gcloud auth application-default print-access-token >/dev/null && echo "ADC OK"
```

Kết quả: `ADC OK`.

Cấu hình gcloud đang hoạt động:

```text
Account: your-google-account@example.com
Project: your-gcp-project-id
Cloud Run region: asia-southeast1
```

Thiết lập biến cho mỗi WSL terminal mới:

```bash
export PROJECT_ID="your-gcp-project-id"
export PROJECT_NUMBER="your-project-number"
export REGION="asia-southeast1"

gcloud config set project "$PROJECT_ID"
gcloud config set run/region "$REGION"
```

Không ghi access token, private key, database password, JWT secret hoặc ImgBB API key vào repository hay terminal history.

## Bước 2 — Kiểm tra Billing và bật API bootstrap

Trước khi Terraform tạo bất kỳ tài nguyên nào, xác nhận project đã gắn Billing:

```bash
gcloud billing projects describe "$PROJECT_ID" \
  --format='yaml(billingEnabled,billingAccountName)'
```

Chỉ khi kết quả có `billingEnabled: true`, bật các API cần cho bootstrap:

```bash
gcloud services enable \
  serviceusage.googleapis.com \
  cloudresourcemanager.googleapis.com \
  storage.googleapis.com
```

Đã xác nhận ba API đang enabled:

```text
cloudresourcemanager.googleapis.com
serviceusage.googleapis.com
storage.googleapis.com
```

## Bước 3 — Tạo bucket lưu Terraform state

Module bootstrap nằm tại:

```text
infrastructure/terraform/bootstrap
```

Module này tạo bucket `your-gcp-project-id-tfstate-your-project-number` tại region `asia-southeast1` với các thuộc tính:

- Storage class: `STANDARD`.
- Uniform bucket-level access: bật.
- Public access prevention: `enforced`.
- Object versioning: bật.
- Xóa phiên bản cũ khi đã có 20 phiên bản mới hơn.
- `force_destroy = false` và `prevent_destroy = true` để tránh xóa nhầm.

Đã chạy:

```bash
cd infrastructure/terraform/bootstrap
terraform init -upgrade
terraform fmt -check
terraform validate
terraform plan -out=bootstrap.tfplan
terraform show bootstrap.tfplan
terraform apply bootstrap.tfplan
```

Đã xác nhận bucket bằng:

```bash
gcloud storage buckets describe gs://your-gcp-project-id-tfstate-your-project-number \
  --project=your-gcp-project-id
```

Kết quả xác nhận bucket tồn tại, bật versioning, chặn public access và dùng uniform bucket-level access.

State của chính module bootstrap vẫn được giữ local và bị Git ignore. Không chuyển state của bootstrap vào bucket do chính bootstrap quản lý.

Hai script hỗ trợ thao tác lại module bootstrap:

```bash
bash scripts/gcp-shared/terraform-apply.sh
bash scripts/gcp-shared/terraform-delete.sh
```

Script delete từ chối chạy nếu bucket còn chứa object, vì object đó có thể là remote state của hạ tầng chính.

## Bước 4 — Tạo foundation

Module foundation nằm tại:

```text
infrastructure/terraform/foundation
```

Foundation dùng GCS backend với prefix:

```text
philobiblus/foundation
```

Đã khởi tạo backend bằng bucket bootstrap:

```bash
terraform init \
  -backend-config="bucket=your-gcp-project-id-tfstate-your-project-number"
```

Plan đã được kiểm tra trước khi apply:

```text
Plan: 31 to add, 0 to change, 0 to destroy.
```

Đã apply thành công:

```text
Apply complete! Resources: 31 added, 0 changed, 0 destroyed.
```

Các tài nguyên chính đã tạo:

- Artifact Registry repository `philobiblus`.
- VPC `philobiblus-dev-vpc`, subnet, Cloud Router và Cloud NAT.
- Private Service Access cho Cloud SQL.
- Cloud SQL PostgreSQL 16 `philobiblus-dev-postgres`, `db-f1-micro`, `ZONAL`, chỉ dùng private IP.
- Database `philobiblus`.
- Service account cho backend, recommendation và seed job.
- Secret Manager secret cho database URL, JWT secret và ImgBB API.
- IAM cho Cloud SQL Client và Secret Manager Secret Accessor.

Remote state đã được xác nhận tại:

```text
gs://your-gcp-project-id-tfstate-your-project-number/philobiblus/foundation/default.tfstate
```

Plan hậu kiểm trả về:

```text
No changes. Your infrastructure matches the configuration.
```

Script apply hiện chạy tuần tự `bootstrap` rồi `foundation`:

```bash
bash scripts/gcp-shared/terraform-apply.sh
```

Script destroy kiểm tra bucket không chứa state ngoài foundation, tắt deletion protection của Cloud SQL, destroy foundation rồi mới destroy bootstrap. Nếu Google Cloud chưa giải phóng Private Service Access sau khi xóa Cloud SQL, script retry tối đa 15 lần với khoảng chờ 60 giây:

```bash
bash scripts/gcp-shared/terraform-delete.sh
```


## Step 5 - Public images and runtime secrets

Two public images were built and pushed to Docker Hub. Runtime deployment will use immutable digests, not the latest tag:

| Service | Image digest |
| --- | --- |
| Backend | your-dockerhub-username/philobiblus-backend@sha256:cc1afdbe1f4d508cebba4970d30accfe86d2bdde677b644d743688b626a1c4e2 |
| Recommendation service | your-dockerhub-username/philobiblus-recommendation@sha256:8d33d44a9556af610b69ec117a64fd887ec309c24ad3708841693ec55910a652 |

DATABASE_URL and SECRET_KEY each have enabled version 1. The ImgBB API secret has not received a value yet.

scripts/gcp-shared/terraform-secrets-apply.sh initializes runtime credentials for a fresh environment. It reads foundation outputs, creates philobiblus_app when missing, and adds DATABASE_URL, SECRET_KEY, and ImgBB API key versions to Secret Manager. It is separate from terraform-apply.sh because normal Terraform apply must not create or rotate secret values.

If the database user already exists, the script stops to protect its current password. Use ROTATE_DB_PASSWORD=true only when intentionally rotating the Cloud SQL password and DATABASE_URL secret.


## Step 6 - Runtime plan validated

The runtime module now has an explicit Google provider in versions.tf. It reads project_id and region from terraform.tfvars.

terraform init, terraform fmt, terraform validate, and terraform plan completed successfully. The generated runtime.tfplan contains:

- 5 resources to add.
- 0 resources to change.
- 0 resources to destroy.

The planned resources are the backend Cloud Run service, internal recommendation Cloud Run service, Cloud Run seed job, and two Cloud Run IAM bindings. Runtime was subsequently redeployed; its Cloud Run services and seed job are active.

The alert_email variable is configured, but the current runtime module has no Cloud Monitoring notification channel or alert policy resource. It does not send alert email until monitoring resources are added.
