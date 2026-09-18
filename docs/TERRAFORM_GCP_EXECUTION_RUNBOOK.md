# Nhật ký thực hành Terraform trên Google Cloud

> Chỉ ghi những bước đã được hướng dẫn và xác nhận thực hiện. Các bước chưa làm sẽ được hướng dẫn trong chat trước, rồi mới bổ sung vào tài liệu này.

## Phạm vi

- Dự án: `grace-enhanced`
- Project number: `6515597414`
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
Account: yungngq@gmail.com
Project: grace-enhanced
Cloud Run region: asia-southeast1
```

Thiết lập biến cho mỗi WSL terminal mới:

```bash
export PROJECT_ID="grace-enhanced"
export PROJECT_NUMBER="6515597414"
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

Phần tạo bucket state bằng Terraform sẽ được hướng dẫn trong chat trước rồi mới được bổ sung vào runbook.
