# Triển khai Philobiblus lên Google Cloud bằng Terraform

> Cập nhật và đối chiếu tài liệu chính thức ngày 17/09/2026.
>
> Phạm vi: backend FastAPI, recommendation service, PostgreSQL, mạng, secret và giám sát. Frontend không được triển khai trong quy trình này; frontend có thể tiếp tục chạy trên GitHub Pages.

## 1. Kiến trúc đích

- Cloud Run service **philobiblus-backend** cung cấp API HTTPS công khai.
- Cloud Run service **philobiblus-recommendation** chỉ nhận lưu lượng nội bộ.
- Cloud Run job **philobiblus-seed** chạy migration SQL và seed khi người vận hành yêu cầu.
- Cloud SQL for PostgreSQL 16 dùng private IP, backup tự động và point-in-time recovery.
- Artifact Registry lưu hai container image.
- Secret Manager lưu DATABASE_URL, SECRET_KEY và IMGBB_API.
- Custom VPC, Direct VPC egress và Cloud NAT cho phép Cloud Run truy cập Cloud SQL, gọi service nội bộ và truy cập ImgBB/Hugging Face.
- Cloud Logging và Cloud Monitoring thay phần Prometheus/Grafana runtime.
- GCS backend lưu Terraform state, bật versioning và state locking.

~~~mermaid
flowchart LR
    FE[Frontend ngoài phạm vi] -->|HTTPS /api| BE[Cloud Run Backend]
    BE -->|internal HTTPS| REC[Cloud Run Recommendation]
    BE -->|Cloud SQL socket| SQL[(Cloud SQL PostgreSQL)]
    JOB[Cloud Run Job] --> SQL
    BE --> SM[Secret Manager]
    JOB --> SM
    AR[Artifact Registry] --> BE
    AR --> REC
    AR --> JOB
    BE --> OBS[Cloud Logging và Monitoring]
~~~

Cloud Run đã cung cấp HTTPS endpoint nên không cần chạy Nginx riêng. Không dựng GKE chỉ để giữ Prometheus/Grafana cho hai workload serverless. Endpoint /metrics của ứng dụng vẫn tồn tại, nhưng không nên dùng làm endpoint public production nếu chưa tách hoặc bảo vệ nó.

## 2. Cơ sở kỹ thuật và phiên bản

Các lựa chọn này đã được đối chiếu với tài liệu chính thức:

- Terraform 1.16.2 là bản hiện hành khi tài liệu được viết: [Install Terraform](https://developer.hashicorp.com/terraform/install).
- Google provider 8.2.0 là bản hiện hành: [Google provider](https://registry.terraform.io/providers/hashicorp/google/latest/docs).
- Google khuyến nghị Application Default Credentials cho Terraform: [Authentication for Terraform](https://cloud.google.com/docs/terraform/authentication).
- GCS backend hỗ trợ state locking, bucket phải tồn tại trước và nên bật Object Versioning: [Terraform GCS backend](https://developer.hashicorp.com/terraform/language/backend/gcs).
- Direct VPC egress là lựa chọn được khuyến nghị thay cho connector khi phù hợp: [Connect Cloud Run to a VPC](https://cloud.google.com/run/docs/configuring/connecting-vpc).
- Cloud SQL private IP cần private services access: [Cloud SQL private IP](https://cloud.google.com/sql/docs/postgres/private-ip).
- Production nên dùng Cloud SQL HA regional cùng backup và PITR: [Cloud SQL HA](https://cloud.google.com/sql/docs/postgres/configure-ha).
- Secret value tạo bằng Terraform có thể nằm dạng rõ trong state; Google khuyên không lưu secret vào state: [Terraform security](https://cloud.google.com/docs/terraform/best-practices/security).
- Cloud Run v2 hỗ trợ service, job, health probe, Secret Manager và Cloud SQL volume: [Cloud Run service](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/cloud_run_v2_service), [Cloud Run jobs](https://cloud.google.com/run/docs/create-jobs).
- Monitoring alert có thể quản lý bằng Terraform: [Alerting with Terraform](https://cloud.google.com/monitoring/alerts/terraform).

## 3. Điều kiện ban đầu

Cần có:

1. Google Cloud project đã gắn billing.
2. Quyền quản lý API, IAM, service account, VPC, Cloud SQL, Cloud Run, Artifact Registry, Secret Manager và Monitoring.
3. Terraform 1.16.x, Google Cloud CLI và Docker.
4. File ml/models/tfidf_recommender.joblib đã có. Nếu DVC quản lý file này, chạy dvc pull trước khi build.
5. Origin frontend thật, ví dụ https://user.github.io, không có dấu slash cuối.
6. ImgBB API key nếu dùng upload cover.

Kiểm tra công cụ, ưu tiên WSL:

~~~bash
terraform version
gcloud version
docker version
git --version
~~~

Đăng nhập:

~~~bash
export PROJECT_ID="your-gcp-project-id"
export REGION="asia-southeast1"

gcloud auth login
gcloud auth application-default login
gcloud config set project "$PROJECT_ID"
gcloud config set run/region "$REGION"

gcloud services enable \
  serviceusage.googleapis.com \
  cloudresourcemanager.googleapis.com
~~~

Không tải service-account JSON key về máy. Trong tổ chức, nên dùng service-account impersonation hoặc Workload Identity Federation.

## 4. Tách Terraform thành ba root module

Thay file infrastructure/terraform/main.tf đang rỗng bằng cấu trúc:

~~~text
infrastructure/terraform/
├── bootstrap/
│   ├── versions.tf
│   ├── main.tf
│   └── backend.tf
├── foundation/
│   ├── versions.tf
│   ├── backend.tf
│   ├── variables.tf
│   ├── main.tf
│   ├── outputs.tf
│   └── terraform.tfvars
└── runtime/
    ├── versions.tf
    ├── backend.tf
    ├── variables.tf
    ├── main.tf
    ├── monitoring.tf
    ├── outputs.tf
    └── terraform.tfvars
~~~

Lý do:

1. bootstrap tạo bucket state vì backend GCS phải tồn tại trước terraform init.
2. foundation tạo repository, mạng, Cloud SQL, service account và tên secret.
3. Sau đó mới build image và tạo secret version ngoài Terraform state.
4. runtime dùng image và secret đã tồn tại để tạo Cloud Run.

Cách này tránh dùng terraform apply -target như một quy trình deploy thường xuyên.

## 5. Module bootstrap

### 5.1 versions.tf

~~~hcl
terraform {
  required_version = ">= 1.16.0, < 2.0.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 8.2"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

variable "project_id" {
  type = string
}

variable "region" {
  type    = string
  default = "asia-southeast1"
}

variable "state_bucket_name" {
  type = string
}
~~~

### 5.2 main.tf

~~~hcl
resource "google_storage_bucket" "terraform_state" {
  name                        = var.state_bucket_name
  project                     = var.project_id
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      num_newer_versions = 20
    }
    action {
      type = "Delete"
    }
  }

  lifecycle {
    prevent_destroy = true
  }
}
~~~

Tên bucket phải duy nhất toàn cầu. Chạy lần đầu bằng local state:

~~~bash
cd infrastructure/terraform/bootstrap
terraform init
terraform fmt -check
terraform validate
terraform plan \
  -var="project_id=$PROJECT_ID" \
  -var="region=$REGION" \
  -var="state_bucket_name=${PROJECT_ID}-terraform-state"
terraform apply \
  -var="project_id=$PROJECT_ID" \
  -var="region=$REGION" \
  -var="state_bucket_name=${PROJECT_ID}-terraform-state"
~~~

Sau khi bucket tồn tại, tạo backend.tf:

~~~hcl
terraform {
  backend "gcs" {
    prefix = "philobiblus/bootstrap"
  }
}
~~~

Migrate state:

~~~bash
terraform init -migrate-state \
  -backend-config="bucket=${PROJECT_ID}-terraform-state"
~~~

Không commit terraform.tfstate, .terraform, plan file hoặc tfvars có dữ liệu riêng. Commit .terraform.lock.hcl.

## 6. Module foundation

### 6.1 versions.tf và backend.tf

versions.tf:

~~~hcl
terraform {
  required_version = ">= 1.16.0, < 2.0.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 8.2"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
~~~

backend.tf:

~~~hcl
terraform {
  backend "gcs" {
    prefix = "philobiblus/foundation"
  }
}
~~~

### 6.2 variables.tf

~~~hcl
variable "project_id" {
  type = string
}

variable "region" {
  type    = string
  default = "asia-southeast1"
}

variable "environment" {
  type    = string
  default = "prod"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be dev, staging, or prod."
  }
}

variable "database_tier" {
  type    = string
  default = "db-custom-1-3840"
}

variable "protect_data" {
  type    = bool
  default = true
}
~~~

terraform.tfvars mẫu:

~~~hcl
project_id    = "your-gcp-project-id"
region        = "asia-southeast1"
environment   = "prod"
database_tier = "db-custom-1-3840"
protect_data  = true
~~~

### 6.3 main.tf

~~~hcl
locals {
  name = "philobiblus-${var.environment}"

  services = toset([
    "artifactregistry.googleapis.com",
    "compute.googleapis.com",
    "iam.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "servicenetworking.googleapis.com",
    "sqladmin.googleapis.com",
  ])
}

resource "google_project_service" "required" {
  for_each = local.services
  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_compute_network" "main" {
  name                    = "${local.name}-vpc"
  auto_create_subnetworks = false
  depends_on              = [google_project_service.required]
}

resource "google_compute_subnetwork" "run" {
  name                     = "${local.name}-run"
  region                   = var.region
  network                  = google_compute_network.main.id
  ip_cidr_range            = "10.20.0.0/24"
  private_ip_google_access = true
}

resource "google_compute_global_address" "private_services" {
  name          = "${local.name}-private-services"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.main.id
}

resource "google_service_networking_connection" "private_services" {
  network                 = google_compute_network.main.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_services.name]
}

resource "google_compute_router" "run" {
  name    = "${local.name}-router"
  region  = var.region
  network = google_compute_network.main.id
}

resource "google_compute_router_nat" "run" {
  name                               = "${local.name}-nat"
  router                             = google_compute_router.run.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "LIST_OF_SUBNETWORKS"

  subnetwork {
    name                    = google_compute_subnetwork.run.id
    source_ip_ranges_to_nat = ["ALL_IP_RANGES"]
  }

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}

resource "google_artifact_registry_repository" "containers" {
  location      = var.region
  repository_id = "philobiblus"
  description   = "Philobiblus runtime images"
  format        = "DOCKER"

  cleanup_policy_dry_run = false

  cleanup_policies {
    id     = "keep-recent"
    action = "KEEP"
    most_recent_versions {
      keep_count = 10
    }
  }

  depends_on = [google_project_service.required]
}

resource "google_service_account" "backend" {
  account_id   = "philobiblus-backend"
  display_name = "Philobiblus backend runtime"
}

resource "google_service_account" "recommendation" {
  account_id   = "philobiblus-recommend"
  display_name = "Philobiblus recommendation runtime"
}

resource "google_service_account" "seed" {
  account_id   = "philobiblus-seed"
  display_name = "Philobiblus migration and seed job"
}

resource "google_project_iam_member" "backend_cloudsql" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.backend.email}"
}

resource "google_project_iam_member" "seed_cloudsql" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.seed.email}"
}

resource "google_secret_manager_secret" "database_url" {
  secret_id = "${local.name}-database-url"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "jwt_secret" {
  secret_id = "${local.name}-jwt-secret"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "imgbb_api" {
  secret_id = "${local.name}-imgbb-api"
  replication {
    auto {}
  }
}

locals {
  backend_secrets = {
    database_url = google_secret_manager_secret.database_url.id
    jwt_secret   = google_secret_manager_secret.jwt_secret.id
    imgbb_api    = google_secret_manager_secret.imgbb_api.id
  }

  seed_secrets = {
    database_url = google_secret_manager_secret.database_url.id
    jwt_secret   = google_secret_manager_secret.jwt_secret.id
  }
}

resource "google_secret_manager_secret_iam_member" "backend" {
  for_each  = local.backend_secrets
  secret_id = each.value
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.backend.email}"
}

resource "google_secret_manager_secret_iam_member" "seed" {
  for_each  = local.seed_secrets
  secret_id = each.value
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.seed.email}"
}

resource "google_sql_database_instance" "postgres" {
  name             = "${local.name}-postgres"
  region           = var.region
  database_version = "POSTGRES_16"

  deletion_protection = var.protect_data

  settings {
    tier              = var.database_tier
    availability_type = var.environment == "prod" ? "REGIONAL" : "ZONAL"
    disk_type         = "PD_SSD"
    disk_size         = 20
    disk_autoresize   = true

    deletion_protection_enabled = var.protect_data

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      start_time                     = "18:00"
      transaction_log_retention_days = 7

      backup_retention_settings {
        retained_backups = 14
        retention_unit   = "COUNT"
      }
    }

    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.main.id
    }

    maintenance_window {
      day          = 7
      hour         = 19
      update_track = "stable"
    }

    user_labels = {
      application = "philobiblus"
      environment = var.environment
    }
  }

  depends_on = [
    google_project_service.required,
    google_service_networking_connection.private_services,
  ]
}

resource "google_sql_database" "app" {
  name     = "philobiblus"
  instance = google_sql_database_instance.postgres.name
}
~~~

Production dùng REGIONAL; dev/staging dùng ZONAL để giảm chi phí. Không tạo google_sql_user chứa password trong Terraform vì password sẽ nằm trong state.

### 6.4 outputs.tf

~~~hcl
output "network_id" {
  value = google_compute_network.main.id
}

output "subnetwork_id" {
  value = google_compute_subnetwork.run.id
}

output "sql_instance_name" {
  value = google_sql_database_instance.postgres.name
}

output "sql_connection_name" {
  value = google_sql_database_instance.postgres.connection_name
}

output "backend_service_account" {
  value = google_service_account.backend.email
}

output "recommendation_service_account" {
  value = google_service_account.recommendation.email
}

output "seed_service_account" {
  value = google_service_account.seed.email
}

output "database_url_secret_id" {
  value = google_secret_manager_secret.database_url.secret_id
}

output "jwt_secret_id" {
  value = google_secret_manager_secret.jwt_secret.secret_id
}

output "imgbb_api_secret_id" {
  value = google_secret_manager_secret.imgbb_api.secret_id
}
~~~

### 6.5 Apply foundation

~~~bash
cd infrastructure/terraform/foundation
terraform init -backend-config="bucket=${PROJECT_ID}-terraform-state"
terraform fmt -check -recursive
terraform validate
terraform plan -out=foundation.tfplan
terraform show foundation.tfplan
terraform apply foundation.tfplan
rm -f foundation.tfplan
~~~

PowerShell:

~~~powershell
Remove-Item -LiteralPath foundation.tfplan -ErrorAction SilentlyContinue
~~~

## 7. Build và push container image

Dùng commit SHA làm tag bất biến:

~~~bash
cd "$(git rev-parse --show-toplevel)/phase-2/track-mlops-security/philobiblus"

export IMAGE_TAG="$(git rev-parse --short=12 HEAD)"
export REGISTRY="${REGION}-docker.pkg.dev/${PROJECT_ID}/philobiblus"

gcloud auth configure-docker "${REGION}-docker.pkg.dev"

docker build \
  -f backend/Dockerfile \
  -t "${REGISTRY}/backend:${IMAGE_TAG}" \
  backend

docker build \
  -f ml/recommendation-service/Dockerfile \
  -t "${REGISTRY}/recommendation:${IMAGE_TAG}" \
  .

docker push "${REGISTRY}/backend:${IMAGE_TAG}"
docker push "${REGISTRY}/recommendation:${IMAGE_TAG}"

gcloud artifacts docker images list "$REGISTRY" --include-tags
~~~

Backend dùng context backend. Recommendation phải dùng context gốc philobiblus vì Dockerfile copy cả service và model joblib.

Production nên tham chiếu digest thay cho latest:

~~~bash
gcloud artifacts docker images describe \
  "${REGISTRY}/backend:${IMAGE_TAG}" \
  --format='value(image_summary.digest)'

gcloud artifacts docker images describe \
  "${REGISTRY}/recommendation:${IMAGE_TAG}" \
  --format='value(image_summary.digest)'
~~~

Nếu build bằng Cloud Build, dùng file cấu hình chỉ rõ Dockerfile của recommendation vì Dockerfile không nằm ở root. Tài liệu chính thức: [Build container images](https://cloud.google.com/build/docs/building/build-containers).

## 8. Tạo database user và secret version ngoài state

### 8.1 WSL/Bash

~~~bash
cd infrastructure/terraform/foundation

export SQL_INSTANCE="$(terraform output -raw sql_instance_name)"
export SQL_CONNECTION="$(terraform output -raw sql_connection_name)"
export DB_SECRET="$(terraform output -raw database_url_secret_id)"
export JWT_SECRET="$(terraform output -raw jwt_secret_id)"
export IMGBB_SECRET="$(terraform output -raw imgbb_api_secret_id)"

export DB_USER="philobiblus_app"
export DB_NAME="philobiblus"
export DB_PASSWORD="$(openssl rand -hex 32)"
export JWT_VALUE="$(openssl rand -hex 64)"

gcloud sql users create "$DB_USER" \
  --instance="$SQL_INSTANCE" \
  --password="$DB_PASSWORD"

DATABASE_URL="postgresql+psycopg2://${DB_USER}:${DB_PASSWORD}@/${DB_NAME}?host=/cloudsql/${SQL_CONNECTION}"

printf '%s' "$DATABASE_URL" |
  gcloud secrets versions add "$DB_SECRET" --data-file=-

printf '%s' "$JWT_VALUE" |
  gcloud secrets versions add "$JWT_SECRET" --data-file=-

read -rsp "ImgBB API key: " IMGBB_VALUE
printf '%s' "$IMGBB_VALUE" |
  gcloud secrets versions add "$IMGBB_SECRET" --data-file=-

unset DB_PASSWORD JWT_VALUE IMGBB_VALUE DATABASE_URL
~~~

Hexadecimal password không cần URL-encode trong SQLAlchemy URL. Nếu user đã tồn tại, dùng gcloud sql users set-password thay cho create.

### 8.2 PowerShell

~~~powershell
$SQL_INSTANCE = terraform output -raw sql_instance_name
$SQL_CONNECTION = terraform output -raw sql_connection_name
$DB_SECRET = terraform output -raw database_url_secret_id
$JWT_SECRET = terraform output -raw jwt_secret_id
$IMGBB_SECRET = terraform output -raw imgbb_api_secret_id

function Add-SecretVersion([string]$Secret, [string]$Value) {
  $TempFile = New-TemporaryFile
  try {
    [IO.File]::WriteAllText($TempFile.FullName, $Value, [Text.UTF8Encoding]::new($false))
    gcloud secrets versions add $Secret --data-file=$TempFile.FullName
  }
  finally {
    Remove-Item -LiteralPath $TempFile.FullName -Force -ErrorAction SilentlyContinue
  }
}

$DB_USER = "philobiblus_app"
$DB_NAME = "philobiblus"
$DbBytes = [byte[]]::new(32)
[Security.Cryptography.RandomNumberGenerator]::Fill($DbBytes)
$DB_PASSWORD = [Convert]::ToHexString($DbBytes).ToLowerInvariant()
$JwtBytes = [byte[]]::new(64)
[Security.Cryptography.RandomNumberGenerator]::Fill($JwtBytes)
$JWT_VALUE = [Convert]::ToHexString($JwtBytes).ToLowerInvariant()

gcloud sql users create $DB_USER --instance=$SQL_INSTANCE --password=$DB_PASSWORD

$DATABASE_URL = "postgresql+psycopg2://${DB_USER}:${DB_PASSWORD}@/${DB_NAME}?host=/cloudsql/${SQL_CONNECTION}"
Add-SecretVersion $DB_SECRET $DATABASE_URL
Add-SecretVersion $JWT_SECRET $JWT_VALUE

$SecureImgBb = Read-Host "ImgBB API key" -AsSecureString
$ImgBbPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureImgBb)
try {
  $ImgBbValue = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ImgBbPtr)
  Add-SecretVersion $IMGBB_SECRET $ImgBbValue
}
finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ImgBbPtr)
  Remove-Variable ImgBbValue, DB_PASSWORD, JWT_VALUE, DATABASE_URL -ErrorAction SilentlyContinue
}
~~~

Không in secret ra console hoặc CI log. Hàm PowerShell trên ghi UTF-8 không BOM và không thêm newline, rồi luôn xóa file tạm trong finally.

## 9. Module runtime

runtime/versions.tf dùng cùng constraint Terraform và provider như foundation.

### 9.1 backend.tf và variables.tf

backend.tf:

~~~hcl
terraform {
  backend "gcs" {
    prefix = "philobiblus/runtime"
  }
}
~~~

variables.tf:

~~~hcl
variable "project_id" {
  type = string
}

variable "region" {
  type    = string
  default = "asia-southeast1"
}

variable "state_bucket_name" {
  type = string
}

variable "environment" {
  type    = string
  default = "prod"
}

variable "backend_image" {
  type = string
}

variable "recommendation_image" {
  type = string
}

variable "allowed_origins" {
  type = list(string)

  validation {
    condition     = length(var.allowed_origins) > 0
    error_message = "At least one frontend origin is required."
  }
}

variable "alert_email" {
  type = string
}

variable "protect_runtime" {
  type    = bool
  default = true
}
~~~

terraform.tfvars mẫu:

~~~hcl
project_id           = "your-gcp-project-id"
region               = "asia-southeast1"
state_bucket_name    = "your-gcp-project-id-terraform-state"
environment          = "prod"
backend_image        = "asia-southeast1-docker.pkg.dev/your-gcp-project-id/philobiblus/backend@sha256:..."
recommendation_image = "asia-southeast1-docker.pkg.dev/your-gcp-project-id/philobiblus/recommendation@sha256:..."
allowed_origins      = ["https://your-user.github.io"]
alert_email          = "operator@example.com"
protect_runtime      = true
~~~

### 9.2 main.tf: recommendation service

~~~hcl
data "terraform_remote_state" "foundation" {
  backend = "gcs"

  config = {
    bucket = var.state_bucket_name
    prefix = "philobiblus/foundation"
  }
}

locals {
  name            = "philobiblus-${var.environment}"
  allowed_origins = join(",", var.allowed_origins)
}

resource "google_cloud_run_v2_service" "recommendation" {
  name                = "${local.name}-recommendation"
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_INTERNAL_ONLY"
  deletion_protection = var.protect_runtime

  template {
    service_account = data.terraform_remote_state.foundation.outputs.recommendation_service_account
    timeout         = "10s"

    scaling {
      min_instance_count = 0
      max_instance_count = 3
    }

    vpc_access {
      network_interfaces {
        network    = data.terraform_remote_state.foundation.outputs.network_id
        subnetwork = data.terraform_remote_state.foundation.outputs.subnetwork_id
        tags        = ["philobiblus-recommendation"]
      }
      egress = "ALL_TRAFFIC"
    }

    containers {
      image = var.recommendation_image

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle = true
      }

      startup_probe {
        failure_threshold     = 12
        initial_delay_seconds = 2
        timeout_seconds       = 2
        period_seconds        = 5

        http_get {
          path = "/health"
          port = 8080
        }
      }

      liveness_probe {
        failure_threshold = 3
        timeout_seconds   = 2
        period_seconds    = 30

        http_get {
          path = "/health"
          port = 8080
        }
      }
    }
  }
}

# Code hiện tại chưa gửi Google-signed ID token.
# Ingress internal vẫn chặn request trực tiếp từ Internet.
resource "google_cloud_run_v2_service_iam_member" "recommendation_internal_unauthenticated" {
  project  = var.project_id
  location = google_cloud_run_v2_service.recommendation.location
  name     = google_cloud_run_v2_service.recommendation.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
~~~

### 9.3 main.tf: backend service

Nối block sau vào cùng main.tf:

~~~hcl
resource "google_cloud_run_v2_service" "backend" {
  name                = "${local.name}-backend"
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = var.protect_runtime

  template {
    service_account = data.terraform_remote_state.foundation.outputs.backend_service_account
    timeout         = "60s"

    scaling {
      min_instance_count = 0
      max_instance_count = 10
    }

    vpc_access {
      network_interfaces {
        network    = data.terraform_remote_state.foundation.outputs.network_id
        subnetwork = data.terraform_remote_state.foundation.outputs.subnetwork_id
        tags        = ["philobiblus-backend"]
      }
      egress = "ALL_TRAFFIC"
    }

    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [
          data.terraform_remote_state.foundation.outputs.sql_connection_name
        ]
      }
    }

    containers {
      image = var.backend_image

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle = true
      }

      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }

      env {
        name  = "APP_HOST"
        value = "0.0.0.0"
      }

      env {
        name  = "APP_PORT"
        value = "8080"
      }

      env {
        name  = "ACCESS_TOKEN_EXPIRE_MINUTES"
        value = "1440"
      }

      env {
        name  = "ALLOWED_ORIGINS"
        value = local.allowed_origins
      }

      env {
        name  = "RECOMMENDATION_SERVICE_URL"
        value = google_cloud_run_v2_service.recommendation.uri
      }

      env {
        name  = "RECOMMENDATION_TIMEOUT_SECONDS"
        value = "5"
      }

      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = data.terraform_remote_state.foundation.outputs.database_url_secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "SECRET_KEY"
        value_source {
          secret_key_ref {
            secret  = data.terraform_remote_state.foundation.outputs.jwt_secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "IMGBB_API"
        value_source {
          secret_key_ref {
            secret  = data.terraform_remote_state.foundation.outputs.imgbb_api_secret_id
            version = "latest"
          }
        }
      }

      startup_probe {
        failure_threshold     = 20
        initial_delay_seconds = 5
        timeout_seconds       = 3
        period_seconds        = 5

        http_get {
          path = "/health"
          port = 8080
        }
      }

      liveness_probe {
        failure_threshold = 3
        timeout_seconds   = 3
        period_seconds    = 30

        http_get {
          path = "/health"
          port = 8080
        }
      }
    }
  }

  depends_on = [
    google_cloud_run_v2_service_iam_member.recommendation_internal_unauthenticated,
  ]
}

resource "google_cloud_run_v2_service_iam_member" "backend_public" {
  project  = var.project_id
  location = google_cloud_run_v2_service.backend.location
  name     = google_cloud_run_v2_service.backend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
~~~

### 9.4 main.tf: seed job

~~~hcl
resource "google_cloud_run_v2_job" "seed" {
  name                = "${local.name}-seed"
  location            = var.region
  deletion_protection = var.protect_runtime

  template {
    task_count  = 1
    parallelism = 1

    template {
      service_account = data.terraform_remote_state.foundation.outputs.seed_service_account
      timeout         = "1800s"
      max_retries     = 1

      vpc_access {
        network_interfaces {
          network    = data.terraform_remote_state.foundation.outputs.network_id
          subnetwork = data.terraform_remote_state.foundation.outputs.subnetwork_id
          tags        = ["philobiblus-seed"]
        }
        egress = "ALL_TRAFFIC"
      }

      volumes {
        name = "cloudsql"
        cloud_sql_instance {
          instances = [
            data.terraform_remote_state.foundation.outputs.sql_connection_name
          ]
        }
      }

      containers {
        image   = var.backend_image
        command = ["python"]
        args    = ["-m", "scripts.seed_database"]

        resources {
          limits = {
            cpu    = "1"
            memory = "512Mi"
          }
        }

        volume_mounts {
          name       = "cloudsql"
          mount_path = "/cloudsql"
        }

        env {
          name  = "PYTHONPATH"
          value = "/app"
        }

        env {
          name  = "ACCESS_TOKEN_EXPIRE_MINUTES"
          value = "1440"
        }

        env {
          name = "DATABASE_URL"
          value_source {
            secret_key_ref {
              secret  = data.terraform_remote_state.foundation.outputs.database_url_secret_id
              version = "latest"
            }
          }
        }

        env {
          name = "SECRET_KEY"
          value_source {
            secret_key_ref {
              secret  = data.terraform_remote_state.foundation.outputs.jwt_secret_id
              version = "latest"
            }
          }
        }
      }
    }
  }
}
~~~

Cloud Run gọi service INTERNAL_ONLY từ Cloud Run khác chỉ được coi là nội bộ khi request đi qua VPC. Backend vì thế dùng Direct VPC egress ALL_TRAFFIC; subnet bật Private Google Access và Cloud NAT xử lý Internet egress. Xem [private networking](https://cloud.google.com/run/docs/securing/private-networking) và [ingress](https://cloud.google.com/run/docs/securing/ingress).

### 9.5 Hardening recommendation bằng IAM

Mẫu trên chạy được với code hiện tại, nhưng allUsers vẫn là IAM rộng dù ingress mạng đã internal. Production nên:

1. Thêm google-auth vào backend requirements.
2. Lấy Google-signed ID token, đặt audience bằng recommendation URI.
3. Gửi Authorization: Bearer TOKEN trong recommendation_client.py.
4. Cache token đến gần thời điểm hết hạn.
5. Thay IAM member allUsers bằng backend service account:

~~~hcl
resource "google_cloud_run_v2_service_iam_member" "recommendation_backend" {
  project  = var.project_id
  location = google_cloud_run_v2_service.recommendation.location
  name     = google_cloud_run_v2_service.recommendation.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${data.terraform_remote_state.foundation.outputs.backend_service_account}"
}
~~~

Quy trình chuẩn: [Cloud Run service-to-service authentication](https://cloud.google.com/run/docs/authenticating/service-to-service). Không tạo service-account key; workload dùng attached service account và metadata server/ADC.

## 10. Monitoring và cảnh báo

Cloud Run tự gửi request log, stdout/stderr và metric nền tảng vào Cloud Logging/Monitoring. Uptime check dưới đây kiểm tra endpoint public /health.

monitoring.tf:

~~~hcl
resource "google_monitoring_notification_channel" "email" {
  display_name = "Philobiblus operator email"
  type         = "email"

  labels = {
    email_address = var.alert_email
  }
}

resource "google_monitoring_uptime_check_config" "backend" {
  display_name = "${local.name} backend health"
  timeout      = "10s"
  period       = "60s"

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = trimprefix(google_cloud_run_v2_service.backend.uri, "https://")
    }
  }

  http_check {
    path         = "/health"
    port         = 443
    use_ssl      = true
    validate_ssl = true
  }
}

resource "google_monitoring_alert_policy" "backend_uptime" {
  display_name = "${local.name} backend unavailable"
  combiner     = "OR"

  conditions {
    display_name = "Uptime check failed"

    condition_threshold {
      filter = join(" AND ", [
        "metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\"",
        "resource.type=\"uptime_url\"",
        "metric.label.check_id=\"${google_monitoring_uptime_check_config.backend.uptime_check_id}\"",
      ])

      comparison      = "COMPARISON_LT"
      threshold_value = 1
      duration        = "120s"

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_NEXT_OLDER"
        cross_series_reducer = "REDUCE_COUNT_FALSE"
        group_by_fields      = ["resource.label.*"]
      }

      trigger {
        count = 1
      }
    }
  }

  notification_channels = [
    google_monitoring_notification_channel.email.name
  ]

  alert_strategy {
    auto_close = "1800s"
  }
}
~~~

Google gửi email xác minh notification channel. Phải xác minh trước khi kỳ vọng nhận cảnh báo.

Giới hạn hiện tại: backend/app/main.py bỏ qua lỗi database khi startup và /health chỉ trả status ok. Uptime check mới chứng minh HTTP process hoạt động. Nên bổ sung readiness endpoint chạy SELECT 1 rồi đổi startup/uptime check sang endpoint đó.

Lệnh vận hành:

~~~bash
gcloud run services describe philobiblus-prod-backend --region="$REGION"
gcloud run services logs read philobiblus-prod-backend --region="$REGION" --limit=100
gcloud run services logs read philobiblus-prod-recommendation --region="$REGION" --limit=100
gcloud monitoring uptime list-configs
~~~

Trong Cloud Console:

- Cloud Run → Metrics: request count, latency, instance count, CPU, memory.
- Logs Explorer: lọc resource.type="cloud_run_revision".
- Cloud SQL → Monitoring: CPU, connections, storage, transaction log.
- Monitoring → Alerting/Uptime checks: incident và trạng thái.

Nếu bắt buộc dùng Grafana, nối Grafana với Google Cloud Monitoring data source. Managed Service for Prometheus chỉ hợp lý khi đã có collector hoặc GKE; không expose /metrics public.

## 11. Output và apply runtime

outputs.tf:

~~~hcl
output "backend_url" {
  value = google_cloud_run_v2_service.backend.uri
}

output "recommendation_url" {
  value     = google_cloud_run_v2_service.recommendation.uri
  sensitive = true
}

output "seed_job_name" {
  value = google_cloud_run_v2_job.seed.name
}
~~~

Apply:

~~~bash
cd infrastructure/terraform/runtime
terraform init -backend-config="bucket=${PROJECT_ID}-terraform-state"
terraform fmt -check -recursive
terraform validate
terraform plan -out=runtime.tfplan
terraform show runtime.tfplan
terraform apply runtime.tfplan
rm -f runtime.tfplan
~~~

Nếu organization policy không cho allUsers, backend public cần External Application Load Balancer hoặc chính sách do quản trị viên xử lý. Không tắt policy tổ chức chỉ để vượt lỗi apply.

## 12. Chạy migration và seed

Terraform tạo job nhưng không tự execute. Việc chạy job là thao tác imperative:

~~~bash
export SEED_JOB="$(terraform output -raw seed_job_name)"

gcloud run jobs execute "$SEED_JOB" \
  --region="$REGION" \
  --wait

gcloud run jobs executions list \
  --job="$SEED_JOB" \
  --region="$REGION"

gcloud run jobs logs read "$SEED_JOB" \
  --region="$REGION" \
  --limit=200
~~~

Script hiện tại idempotent theo user và khóa owner/title/author, nhưng vẫn phải đọc log trước khi chạy lại production. Script tải catalog từ Hugging Face nên cần Cloud NAT.

Mật khẩu seed mặc định trong mã là admin1111. Sau seed phải đổi mật khẩu admin; không giữ credential demo trên production.

## 13. Kiểm tra sau triển khai

~~~bash
export BACKEND_URL="$(terraform output -raw backend_url)"

curl -fsS "${BACKEND_URL}/health"
curl -fsS "${BACKEND_URL}/"
curl -I "${BACKEND_URL}/docs"
~~~

Kỳ vọng:

- /health trả HTTP 200 và status ok.
- / trả metadata API.
- /docs trả Swagger UI.

Recommendation từ Internet phải bị ingress chặn. Kiểm tra qua backend:

~~~bash
curl -i \
  -H "Authorization: Bearer <JWT>" \
  "${BACKEND_URL}/api/books/recommendations/for-me?limit=5"
~~~

Nếu trả 500:

1. Đọc log backend và recommendation.
2. Xác nhận RECOMMENDATION_SERVICE_URL là Cloud Run URI đúng.
3. Xác nhận backend có Direct VPC egress ALL_TRAFFIC.
4. Xác nhận subnet bật Private Google Access.
5. Xác nhận recommendation ingress internal và IAM binding đúng.
6. Xác nhận image chứa model joblib.
7. Xác nhận secret version latest đang enabled.
8. Xác nhận seed job thành công.

Kiểm tra Cloud SQL:

~~~bash
gcloud sql instances describe "$SQL_INSTANCE" \
  --format='yaml(state,region,settings.availabilityType,settings.backupConfiguration,ipAddresses)'
~~~

Không mở Cloud SQL public IP hoặc 0.0.0.0/0 để debug. Dùng Cloud SQL Auth Proxy hoặc Cloud Shell có đường mạng phù hợp nếu cần truy vấn trực tiếp.

## 14. Nối frontend hiện có

Frontend nằm ngoài quy trình Terraform. Sau khi lấy backend URL:

~~~bash
gh variable set VITE_API_URL \
  --body "${BACKEND_URL}/api"
~~~

allowed_origins phải chứa origin trình duyệt chính xác:

~~~hcl
allowed_origins = ["https://your-user.github.io"]
~~~

CORS origin không chứa path repo và không có slash cuối. VITE_API_URL cần /api vì frontend nối thêm /auth, /books, /admin và các route khác.

## 15. Cập nhật và rollback

Mỗi lần deploy:

1. Pull commit cần phát hành.
2. Build hai image với commit SHA.
3. Push Artifact Registry.
4. Lấy digest.
5. Sửa runtime/terraform.tfvars.
6. terraform plan, review, apply.
7. Kiểm tra revision, log và endpoint.

Không dùng latest ở production. Rollback bằng cách đặt lại digest cũ rồi apply:

~~~bash
gcloud run revisions list \
  --service=philobiblus-prod-backend \
  --region="$REGION"
~~~

Nếu image có migration, chạy job theo chiến lược schema tương thích ngược. Mã hiện tại gộp migration và demo seed; về lâu dài nên tách hai việc này.

## 16. Rotate secret

Tạo version mới ngoài Terraform:

~~~bash
printf '%s' '<new-value>' |
  gcloud secrets versions add philobiblus-prod-jwt-secret --data-file=-
~~~

Secret dạng environment variable được đọc khi revision khởi động. Tạo revision mới hoặc pin số version để bảo đảm rollout.

Rotate database password:

1. Đổi password Cloud SQL.
2. Tạo DATABASE_URL mới.
3. Add secret version.
4. Redeploy backend và job.
5. Test API.
6. Disable version cũ khi không còn revision dùng.

Rotate SECRET_KEY làm JWT đang tồn tại mất hiệu lực, nên cần lịch bảo trì.

## 17. Backup, restore và destroy

Production đã bật HA, backup, PITR, hai lớp deletion protection và GCS state versioning. Phải thử restore định kỳ vào instance mới; backup chưa từng thử restore chưa phải bằng chứng có thể phục hồi.

Muốn destroy môi trường thử nghiệm:

1. Đặt protect_runtime=false và apply runtime.
2. Đặt protect_data=false và apply foundation.
3. Xác nhận backup/export cần giữ.
4. Destroy runtime trước, foundation sau.
5. Bucket state có prevent_destroy; chỉ gỡ khi chắc chắn không còn state cần giữ.

Không chạy terraform destroy trên production như bước dọn lại.

## 18. CI/CD production

Nếu chuyển vào GitHub Actions:

- Dùng Workload Identity Federation, không dùng JSON key.
- Tách plan và apply nếu cần duyệt.
- Chỉ apply plan đã review.
- Serialize apply theo environment.
- Không echo secret hoặc sensitive output.
- Pin action bằng commit SHA và image bằng digest.
- Chạy terraform fmt -check -recursive, init, validate và plan -detailed-exitcode.
- Commit .terraform.lock.hcl.
- Runtime service account không có quyền deploy.

Xem [service-account security best practices](https://cloud.google.com/iam/docs/best-practices-service-accounts).

## 19. Sự cố thường gặp

### Backend GCS chưa tồn tại

Chạy bootstrap trước và kiểm tra tên bucket trong backend-config.

### Terraform dùng sai credential

~~~bash
gcloud auth list
gcloud auth application-default print-access-token >/dev/null
gcloud config get-value project
~~~

gcloud auth login và ADC là hai credential flow khác nhau.

### Secret chưa có version

Tạo secret version ở bước 8 rồi apply runtime lại.

### Image not found

Kiểm tra region, project, repository, digest và image architecture.

### Backend không bind đúng port

Dockerfile dùng APP_PORT thay vì PORT, nên runtime phải đặt APP_PORT=8080 và APP_HOST=0.0.0.0.

### Recommendation trả lỗi

Kiểm tra ingress, IAM, VPC egress, URL và cold start. Mẫu tăng timeout từ 2 lên 5 giây. Có thể đặt min_instance_count=1 nếu chấp nhận chi phí.

### Seed không tải catalog

Kiểm tra Cloud NAT, DNS và egress ALL_TRAFFIC.

### Health 200 nhưng database lỗi

/health chưa kiểm tra database. Xem Cloud SQL, secret URL, Cloud SQL Client role, socket mount và log.

### Không cấp được allUsers

Project có domain-restricted sharing. Dùng load balancer cho backend; dùng ID-token authentication cho recommendation.

### Plan muốn thay Cloud SQL

Dừng lại. Không apply replacement database production. Kiểm tra thay đổi region, version, network và setting force replacement.

## 20. Checklist production

- [ ] Billing và quota đủ.
- [ ] Terraform/provider đúng constraint, lock file đã commit.
- [ ] GCS state bật uniform access, public prevention, versioning và locking.
- [ ] Không có secret trong tfvars, state output, Git hoặc CI log.
- [ ] Cloud SQL private IP, HA regional, backup, PITR và deletion protection.
- [ ] Backend, recommendation và seed dùng service account riêng.
- [ ] Backend public; recommendation internal.
- [ ] Recommendation đã chuyển sang ID-token auth nếu dùng production thật.
- [ ] Container tham chiếu immutable digest.
- [ ] Seed thành công và mật khẩu admin demo đã đổi.
- [ ] Frontend origin khớp ALLOWED_ORIGINS.
- [ ] Notification channel đã xác minh.
- [ ] Đã kiểm tra log, latency, lỗi 5xx, connections và storage.
- [ ] Đã thử rollback image.
- [ ] Đã thử restore Cloud SQL.
- [ ] Đã cấu hình Billing budget alert; budget không tự giới hạn chi phí.
- [ ] Có người phụ trách incident và lịch rotate secret.

## 21. Tài liệu chính thức

- [Terraform install](https://developer.hashicorp.com/terraform/install)
- [Google provider](https://registry.terraform.io/providers/hashicorp/google/latest/docs)
- [Terraform authentication on Google Cloud](https://cloud.google.com/docs/terraform/authentication)
- [Terraform GCS backend](https://developer.hashicorp.com/terraform/language/backend/gcs)
- [Terraform state locking](https://developer.hashicorp.com/terraform/language/state/locking)
- [Terraform security on Google Cloud](https://cloud.google.com/docs/terraform/best-practices/security)
- [Artifact Registry with Terraform](https://cloud.google.com/artifact-registry/docs/repositories/terraform)
- [Cloud Run, Cloud SQL and Secret Manager sample](https://cloud.google.com/run/docs/samples/cloudrun-connect-cloud-sql-parent-tag)
- [Cloud Run Direct VPC](https://cloud.google.com/run/docs/configuring/vpc-direct-vpc)
- [Cloud Run ingress](https://cloud.google.com/run/docs/securing/ingress)
- [Cloud Run service authentication](https://cloud.google.com/run/docs/authenticating/service-to-service)
- [Cloud Run health checks](https://cloud.google.com/run/docs/configuring/healthchecks)
- [Cloud Run jobs](https://cloud.google.com/run/docs/create-jobs)
- [Cloud SQL private IP](https://cloud.google.com/sql/docs/postgres/private-ip)
- [Cloud Run to Cloud SQL PostgreSQL](https://cloud.google.com/sql/docs/postgres/connect-run)
- [Cloud SQL high availability](https://cloud.google.com/sql/docs/postgres/configure-ha)
- [Cloud Monitoring alerts with Terraform](https://cloud.google.com/monitoring/alerts/terraform)
- [Service account security](https://cloud.google.com/iam/docs/best-practices-service-accounts)
