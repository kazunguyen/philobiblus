# Kế hoạch triển khai Philobiblus lên Google Kubernetes Engine

> Cập nhật: 21/09/2026. Kế hoạch này triển khai môi trường `dev` trên GKE Autopilot tại `asia-southeast1`. Mỗi giai đoạn chỉ được đánh dấu hoàn thành khi có output kiểm chứng; không đánh dấu hoàn thành chỉ vì mã nguồn đã được viết.

## 1. Kết quả cần đạt

Triển khai backend, recommendation service và seed job của Philobiblus vào một cụm Kubernetes thật trên Google Cloud. Frontend tiếp tục chạy trên GitHub Pages. PostgreSQL tiếp tục dùng Cloud SQL; secret tiếp tục nằm trong Secret Manager. Không chạy PostgreSQL bằng Pod/PVC trong GKE và không đưa credential vào Git, Terraform state hoặc file Helm values được commit.

Sau khi hoàn thành:

- GKE Autopilot quản lý workload Kubernetes, node, scaling và nâng cấp nền tảng.
- Terraform quản lý GCP platform, cluster, IAM, namespace policy và Helm release.
- Helm quản lý Deployment, Service, Job, HPA, Gateway/HTTPRoute và cấu hình workload.
- Backend kết nối Cloud SQL qua Cloud SQL Auth Proxy sidecar.
- Pod truy cập Google Cloud bằng Workload Identity Federation for GKE, không dùng service-account key.
- Secret Manager cung cấp `DATABASE_URL`, `SECRET_KEY` và `IMGBB_API` cho workload.
- Artifact Registry lưu image theo digest bất biến.
- Managed Service for Prometheus, Cloud Logging và Cloud Monitoring theo dõi hệ thống.
- CI/CD kiểm tra code, image, IaC và triển khai release có thể rollback.

## 2. Kiến trúc mục tiêu

```text
GitHub Pages frontend
        |
        | HTTPS + CORS
        v
Global external HTTPS Load Balancer
        |
GKE Gateway + HTTPRoute
        |
backend Service -> backend Deployment + HPA
        |                    |
        |                    +-> Cloud SQL Auth Proxy sidecar -> Cloud SQL PostgreSQL
        |
        +-> recommendation Service -> recommendation Deployment

seed Job + Cloud SQL Auth Proxy sidecar -> Cloud SQL PostgreSQL

Backend/seed KSA -> Workload Identity -> Google service account
                                      -> Secret Manager / Cloud SQL
Metrics -> Managed Service for Prometheus -> Cloud Monitoring / Grafana
Logs    -> Cloud Logging
```

Cloud Run vẫn hoạt động trong giai đoạn chuyển đổi. Chỉ destroy module `runtime` sau khi endpoint GKE đã ổn định và đường rollback đã được kiểm tra.

## 3. Quyết định kỹ thuật

| Hạng mục | Quyết định | Lý do |
| --- | --- | --- |
| Chế độ GKE | Autopilot, regional, release channel `REGULAR` | Có Kubernetes đầy đủ nhưng không phải tự quản lý node pool; phù hợp môi trường học và workload hiện tại. |
| Region | `asia-southeast1` | Đồng vùng với Cloud SQL, VPC và các tài nguyên hiện có. |
| Database | Cloud SQL hiện có | Tránh vận hành PostgreSQL stateful trong cluster và tránh dữ liệu phụ thuộc vòng đời Pod/PVC. |
| Kết nối database | Cloud SQL Auth Proxy sidecar dùng Unix socket chia sẻ | Giữ được định dạng `DATABASE_URL` hiện tại và có kết nối được IAM xác thực, mã hóa. |
| Secret | Secret Manager add-on + Workload Identity | Không commit secret, không tạo khóa service account dài hạn. |
| Image registry | Artifact Registry, tham chiếu bằng digest | Hỗ trợ IAM, vulnerability scanning và triển khai bất biến. |
| Public traffic | GKE Gateway API + HTTPS load balancer | Áp dụng Gateway/HTTPRoute, static IP, TLS và health check theo chuẩn GKE. |
| Frontend | GitHub Pages | Giữ đúng kiến trúc hiện tại và không trả chi phí Pod cho static frontend. |
| Metrics | Google Managed Service for Prometheus | Không phải tự vận hành toàn bộ Prometheus storage/collector trong Autopilot. |
| State | Ba state độc lập: `foundation`, `gke-platform`, `gke-app` | Cho phép destroy workload/cluster theo đúng thứ tự mà không tác động Cloud SQL và state bucket. |

## 4. Cấu trúc mã nguồn dự kiến

```text
infrastructure/terraform/
├── bootstrap/                 # đã có: GCS state bucket
├── foundation/                # đã có: VPC, Cloud SQL, secrets, service accounts, registry
├── runtime/                   # đã có: Cloud Run, giữ trong giai đoạn migration
├── gke-platform/              # mới: GKE, IAM, static IP, certificate, observability nền
└── gke-app/                   # mới: namespace, policy, SecretProviderClass, Helm release

kubernetes/helm/philobiblus/
├── values.yaml
├── values.gke.example.yaml    # chỉ placeholder, không chứa secret/account thật
└── templates/
    ├── serviceaccounts.yaml
    ├── secret-provider-class.yaml
    ├── gateway.yaml
    ├── httproute.yaml
    ├── networkpolicies.yaml
    ├── podmonitoring.yaml
    └── ...

scripts/
├── gke-apply.sh
├── gke-delete.sh
├── gke-release.sh
└── gke-verify.sh
```

`gke-platform` dùng remote-state prefix `philobiblus/gke-platform`; `gke-app` dùng `philobiblus/gke-app`. Không dùng chung state với Cloud Run runtime.

## 5. Giai đoạn 0 — Chụp baseline và bảo vệ dữ liệu

### Công việc

1. Ghi lại URL Cloud Run backend hiện tại và xác nhận `/health` trả `200`.
2. Chạy backend tests, frontend production build, `helm lint` và `helm template` hiện tại.
3. Xác nhận Cloud SQL automated backup/PITR theo cấu hình hiện có; tạo on-demand backup trước migration dữ liệu nếu seed/migration có khả năng thay đổi schema.
4. Giữ `protect_data = true`, `protect_runtime = true` và đặt `deletion_protection = true` cho cluster khi triển khai bình thường.
5. Tạo budget/alert cho project. Budget alert chỉ cảnh báo, không tự ngắt chi tiêu.
6. Ghi lại các resource đang do ba state `bootstrap`, `foundation`, `runtime` quản lý.

### Tiêu chí hoàn thành

- Có baseline test/build/health thành công.
- Có URL Cloud Run để rollback.
- Có backup Cloud SQL và danh sách Terraform state trước migration.
- Không có secret, `.tfvars`, plan hoặc state mới được Git theo dõi.

## 6. Giai đoạn 1 — Mở rộng foundation cho GKE

### Công việc

1. Bật bằng Terraform các API: Kubernetes Engine, IAM Credentials, Secret Manager, Cloud Monitoring, Cloud Logging, Artifact Registry và Certificate Manager nếu dùng Gateway HTTPS.
2. Tái sử dụng VPC/subnet hiện có; bổ sung secondary IP ranges cho Pod và Service nếu cấu hình cluster yêu cầu.
3. Tạo hoặc chuẩn hóa Google service account:
   - backend: `roles/cloudsql.client` và quyền đọc đúng các secret backend cần;
   - seed: `roles/cloudsql.client` và quyền đọc database/JWT secret cần cho seed;
   - deployment identity của GitHub Actions: chỉ có quyền deploy cần thiết, không dùng Owner/Editor.
4. Cấp IAM ở mức từng secret thay vì cấp `roles/secretmanager.secretAccessor` toàn project khi có thể.
5. Giữ recommendation service không có quyền GCP nếu nó không gọi Google API.

### Tiêu chí hoàn thành

- `terraform fmt`, `validate`, `plan` thành công.
- Plan không xóa hoặc thay thế Cloud SQL/VPC hiện có.
- IAM review cho thấy không có service-account key và không có role Owner/Editor mới.

## 7. Giai đoạn 2 — Tạo GKE Autopilot platform

### Tài nguyên Terraform

`gke-platform` sẽ quản lý:

- `google_container_cluster` ở chế độ Autopilot, regional.
- VPC-native/IP aliasing, Dataplane V2 và Workload Identity mặc định của Autopilot.
- release channel `REGULAR`, maintenance window và cluster notifications.
- Secret Manager add-on.
- Managed Service for Prometheus managed collection.
- Cloud Logging/Monitoring components cần thiết.
- GKE security posture/vulnerability features trong phạm vi ngân sách.
- static global IP cho public backend.
- Certificate Manager certificate/map nếu đã có domain.
- deletion protection được điều khiển bởi biến `protect_cluster`, mặc định `true`.

Không đưa Kubernetes/Helm provider vào state này. Việc tách state tránh lỗi provider khi cluster chưa tồn tại hoặc đang bị destroy.

### Quy trình apply

```bash
terraform -chdir=infrastructure/terraform/gke-platform init \
  -backend-config="bucket=$STATE_BUCKET_NAME"
terraform -chdir=infrastructure/terraform/gke-platform fmt -check -recursive
terraform -chdir=infrastructure/terraform/gke-platform validate
terraform -chdir=infrastructure/terraform/gke-platform plan -out=gke-platform.tfplan
terraform -chdir=infrastructure/terraform/gke-platform apply gke-platform.tfplan

gcloud container clusters get-credentials "$GKE_CLUSTER_NAME" \
  --region="$REGION" \
  --project="$PROJECT_ID"
kubectl cluster-info
kubectl get nodes
```

Các biến trên được đọc từ file local bị Git ignore hoặc từ environment; không hard-code project/account vào file commit.

### Tiêu chí hoàn thành

- Cluster ở trạng thái `RUNNING` và `kubectl cluster-info` thành công.
- Workload Identity, Secret Manager add-on và managed Prometheus đã bật.
- `terraform plan` ngay sau apply trả `No changes`.
- Không có workload ứng dụng ở giai đoạn này.

## 8. Giai đoạn 3 — Làm Helm chart chạy được trên GKE

### Thay đổi bắt buộc

1. Thêm `postgres.enabled`. Khi `false`, chart không render PostgreSQL Deployment, Service và PVC.
2. Thêm `frontend.enabled`. Khi `false`, chart không render frontend Deployment/Service và Gateway không route `/` vào frontend.
3. Backend nhận `DATABASE_URL`, `SECRET_KEY`, `IMGBB_API` từ secret files hoặc Secret Manager CSI; không ghép database password trong values.
4. Backend và seed dùng Cloud SQL Auth Proxy sidecar:
   - chạy non-root;
   - dùng shared `emptyDir` tại `/cloudsql`;
   - proxy mở Unix socket cho Cloud SQL connection name;
   - backend giữ connection string dạng `?host=/cloudsql/<connection-name>`.
5. Tạo Kubernetes service accounts riêng cho backend và seed; recommendation dùng service account không có quyền GCP.
6. Thêm annotation/identity binding cần thiết cho Workload Identity.
7. Thay Ingress Traefik bằng Gateway/HTTPRoute có thể bật theo values. Giữ Traefik option cho local k3d.
8. Chuyển monitoring GKE sang `PodMonitoring` hoặc `ClusterPodMonitoring`; giữ `ServiceMonitor` tùy chọn cho local kube-prometheus-stack.
9. Thêm PodDisruptionBudget, topology spread, probes, requests/limits và security context tương thích Autopilot.
10. Seed Job phải idempotent; không làm hỏng release khi dữ liệu đã tồn tại.

### Values dev dự kiến

```yaml
frontend:
  enabled: false

postgres:
  enabled: false

backend:
  replicaCount: 1
  autoscaling:
    enabled: true
    minReplicas: 1
    maxReplicas: 3

recommendation:
  enabled: true
  replicaCount: 1

ingress:
  enabled: false

gateway:
  enabled: true

monitoring:
  serviceMonitor:
    enabled: false
  podMonitoring:
    enabled: true
```

Image repository/digest, hostname, service-account names và secret resource names được Terraform truyền vào Helm; giá trị secret không được truyền qua Terraform/Helm.

### Tiêu chí hoàn thành

- `helm lint` và `helm template` thành công cho cả local values lẫn GKE example values.
- Render GKE không có PostgreSQL/PVC/frontend/Traefik Ingress.
- Render không chứa password, JWT hoặc ImgBB key.
- Tất cả container có requests/limits, probes và security context phù hợp.

## 9. Giai đoạn 4 — Namespace security và network policy

`gke-app` sẽ tạo trước Helm release:

- namespace `philobiblus` với Pod Security Admission ở mức `restricted` nếu toàn bộ workload tương thích;
- ResourceQuota và LimitRange;
- Kubernetes service accounts;
- Workload Identity IAM bindings;
- SecretProviderClass;
- default-deny NetworkPolicy, sau đó allow tối thiểu cho DNS, Gateway -> backend, backend -> recommendation và HTTPS egress cần thiết;
- Helm release Philobiblus.

NetworkPolicy phải được kiểm thử theo luồng thực tế. ImgBB, Secret Manager và Google APIs dùng HTTPS egress; không khóa egress trước khi có allow rule và kiểm chứng DNS/API connectivity.

### Tiêu chí hoàn thành

- Pod không dùng `default` service account.
- `kubectl auth can-i` xác nhận service account không có quyền Kubernetes thừa.
- Backend/seed truy cập được đúng secret và Cloud SQL; recommendation không đọc được secret backend.
- Một Pod thử nghiệm không được phép gọi Service ngoài allow-list.

## 10. Giai đoạn 5 — Build, scan và phát hành image

### Pipeline image

1. Backend tests và recommendation tests.
2. Build image `linux/amd64` với tag commit SHA.
3. Gitleaks/Semgrep/SCA trên source.
4. Trivy scan image; chặn vulnerability theo policy đã thống nhất.
5. Syft tạo SBOM.
6. Push Artifact Registry.
7. Cosign keyless ký image bằng GitHub OIDC.
8. Lấy image digest và deploy bằng `repository@sha256:...`, không dùng `latest`.

Giai đoạn đầu có thể dùng Docker Hub public để bootstrap, nhưng tiêu chí hoàn thành cuối cùng là Artifact Registry + digest + IAM/OIDC.

### Tiêu chí hoàn thành

- Hai image tồn tại trong Artifact Registry và pull được từ GKE.
- Helm release chỉ tham chiếu digest bất biến.
- CI lưu SBOM và kết quả scan; không lưu registry token trong repository.

## 11. Giai đoạn 6 — Deploy workload và kiểm chứng nội bộ

### Thứ tự

1. Apply `gke-app` để tạo namespace, identity, policy và Helm release.
2. Theo dõi Deployment rollout.
3. Chạy/quan sát seed Job một lần.
4. Port-forward backend để kiểm tra trước khi public Gateway sẵn sàng.

```bash
kubectl get all -n philobiblus
kubectl rollout status deployment/philobiblus-backend -n philobiblus --timeout=10m
kubectl rollout status deployment/philobiblus-recommendation -n philobiblus --timeout=10m
kubectl logs job/philobiblus-seed -n philobiblus --all-containers=true
kubectl port-forward service/philobiblus-backend 18000:8000 -n philobiblus
curl -fsS http://127.0.0.1:18000/health
helm test philobiblus -n philobiblus
```

### Kiểm thử bắt buộc

- health/readiness/liveness;
- đăng nhập và refresh/auth flow;
- public/private book visibility;
- admin endpoints;
- review/comment/friend operations;
- recommendation endpoint và fallback;
- upload ảnh;
- seed chạy lại không tạo dữ liệu sai hoặc làm fail release;
- restart backend Pod không làm gián đoạn dữ liệu.

## 12. Giai đoạn 7 — Public HTTPS, DNS và cutover

GitHub Pages chạy HTTPS nên backend GKE cũng phải có HTTPS; endpoint HTTP sẽ bị trình duyệt chặn vì mixed content.

Runbook thực thi chi tiết cho Gemini: [GKE_PHASE_7_HTTPS_DOMAIN_RUNBOOK.md](GKE_PHASE_7_HTTPS_DOMAIN_RUNBOOK.md).

### Công việc

1. Gán static global IP cho Gateway.
2. Có một hostname do người dùng quản lý, ví dụ `api.example.com`.
3. Tạo DNS A record trỏ hostname tới static IP.
4. Cấp Google-managed certificate bằng Certificate Manager và gắn vào Gateway.
5. Tạo HTTPRoute chỉ route backend API; không public recommendation service.
6. Xác nhận Load Balancer health check và certificate ở trạng thái active.
7. Kiểm tra CORS với origin GitHub Pages thực.

### Cutover

1. Giữ Cloud Run backend hoạt động.
2. Chạy smoke/load test qua HTTPS URL.
3. Ghi lại URL cho rollback.
4. Người vận hành đổi GitHub Actions variable:

```text
VITE_API_URL=https://<API_HOSTNAME_OR_PROXY>/api
```

5. Redeploy GitHub Pages và kiểm tra toàn bộ browser flow.
6. Theo dõi ít nhất một khoảng soak test đã thống nhất trước khi thu hồi các tài nguyên chuyển tiếp.

### Phương án thay thế khi chưa có custom domain: Cloud Run HTTPS Proxy

Trong trường hợp chưa có custom domain đăng ký để gắn Certificate Manager vào GKE Gateway, ta kích hoạt phương án trung gian qua module IaC `infrastructure/terraform/https-proxy`:
- Kiến trúc luồng: `GitHub Pages (HTTPS) -> Cloud Run Nginx Proxy (HTTPS do Google chứng nhận) -> GKE Gateway (HTTP static IP) -> Backend Pod`.
- Module Terraform quản lý: `infrastructure/terraform/https-proxy` với GCS remote state `philobiblus/https-proxy`.
- Container proxy: `asia-southeast1-docker.pkg.dev/grace-enhanced/philobiblus/https-proxy` chạy Nginx forward request tới `136.68.162.254`, chuyển tiếp toàn bộ header CORS và client.
- Endpoint public hiện tại: `https://philobiblus-dev-proxy-qi7zqa4cnq-as.a.run.app/api`.
- Script tự động: `bash scripts/k8s-terraform/35-proxy-apply.sh` (áp dụng) và `bash scripts/k8s-terraform/36-proxy-destroy.sh` (thu hồi khi có domain riêng).
- CORS/proxy cutover và cách tránh ghi nhầm URL Cloud Run runtime: `GKE_HTTPS_PROXY_CORS_RUNBOOK.md`.

### Rollback

- Đổi `VITE_API_URL` về Cloud Run URL cũ và redeploy frontend.
- Với lỗi release, dùng `helm rollback` về revision trước.
- Không rollback bằng cách restore database nếu chưa xác định migration nào đã chạy.

## 13. Giai đoạn 8 — Observability và SRE

### Metrics và alert

- Managed Service for Prometheus scrape backend/recommendation bằng `PodMonitoring`.
- Dashboard gồm target health, request rate, 4xx/5xx, p95 latency, recommendation latency/error, CPU, memory, Pod restart và HPA replica.
- Cloud Monitoring alert cho backend unavailable, 5xx ratio, p95 latency, Pod crash loop, Cloud SQL health và certificate expiry.
- Mỗi alert có link tới runbook trong `docs/monitoring`.

### Logs

- Structured JSON logs có request ID/correlation ID.
- Cloud Logging query phân biệt backend, recommendation, seed và Cloud SQL proxy.
- Không log JWT, password, secret value hoặc full authorization header.

### SLI/SLO ban đầu

- availability của API;
- p95 latency;
- recommendation success/fallback ratio;
- error budget theo cửa sổ 30 ngày cho môi trường production sau này.

### Tiêu chí hoàn thành

- Metrics có dữ liệu thật sau smoke/load test.
- Một alert thử nghiệm đi từ metric -> firing -> notification/runbook.
- Có thể truy vết một request từ frontend tới backend và recommendation qua log.

## 14. Giai đoạn 9 — CI/CD cho GKE

### CI pull request

- backend/recommendation tests;
- frontend build;
- Terraform fmt/validate và TFLint/checkov trong phạm vi đã chọn;
- Helm lint/template;
- Gitleaks, Semgrep, dependency scan;
- Docker build và Trivy scan, chưa push ở PR không tin cậy.

### CD main/release

- GitHub Actions xác thực GCP bằng Workload Identity Federation, không dùng JSON service-account key;
- build, scan, SBOM, ký và push image;
- cập nhật release bằng image digest;
- environment approval trước production/cutover;
- `helm upgrade --atomic --wait` hoặc Terraform `helm_release` với timeout phù hợp;
- rollout check, Helm test và smoke test;
- rollback revision nếu health check thất bại.

Terraform platform apply là workflow riêng có plan artifact và approval; không chạy destroy tự động trong CI.

## 15. Giai đoạn 10 — MLOps trên cluster

- DVC tiếp tục quản lý dataset/pipeline và không nhúng credential remote vào Git.
- MLflow theo dõi experiment/model version ngoài request-serving path.
- Recommendation image chứa model version đã chọn hoặc tải artifact theo cơ chế có kiểm soát.
- Expose model version tại `/health` và metric.
- Canary release recommendation bằng hai Deployment/digest hoặc traffic split khi cần chứng minh kỹ thuật.
- Theo dõi latency, error, fallback, coverage và metric chất lượng offline; không chỉ theo dõi CPU/memory.

## 16. Giai đoạn 11 — Kết thúc migration và tối ưu chi phí

Chỉ sau khi GKE chạy ổn định:

1. Đặt Cloud Run runtime deletion protection về `false` và apply trạng thái đó.
2. Destroy riêng state `runtime`; không chạy foundation/bootstrap destroy.
3. Xác nhận Cloud SQL, Secret Manager, Artifact Registry và GKE không bị tác động.
4. Cập nhật tài liệu, sơ đồ, URL, dashboard và bằng chứng.
5. Theo dõi billing; giữ dev ở một backend replica và một recommendation replica.
6. Tắt cluster khi không còn cần demo bằng quy trình destroy có kiểm soát; Autopilot cluster không có thao tác “stop”.

Thứ tự destroy an toàn:

```text
gke-app -> gke-platform -> foundation -> bootstrap
```

`foundation` và `bootstrap` chỉ destroy khi thực sự muốn xóa Cloud SQL, secret, VPC và state bucket.

## 17. Các mốc commit đề xuất

1. `feat(terraform): add GKE Autopilot platform`
2. `feat(helm): support external GCP services`
3. `feat(terraform): deploy Philobiblus to GKE`
4. `feat(observability): add GKE metrics and alerts`
5. `ci(gke): add secure image delivery`
6. `docs(gke): add deployment and rollback runbook`

Mỗi commit phải qua kiểm tra liên quan và không chứa `.tfvars`, Terraform state/plan, secret, kubeconfig, token, account email hoặc giá trị project cá nhân. File cấu hình thật phải bị ignore và có file `.example` dùng placeholder.

## 18. Definition of Done

- Terraform tạo lại được GKE platform và app release từ đầu bằng state từ xa.
- Backend, recommendation và seed chạy trong GKE; frontend GitHub Pages gọi backend qua HTTPS.
- Không có PostgreSQL Pod/PVC và không có secret thật trong Git/Terraform state/Helm values.
- Workload Identity và least-privilege IAM được kiểm chứng.
- Image được scan, có SBOM, ký và deploy theo digest.
- Probes, resources, HPA, PDB, security context, quota và NetworkPolicy hoạt động.
- Managed Prometheus/Cloud Logging có dashboard và alert đã kiểm thử.
- Helm upgrade, rollback và Cloud Run URL rollback đều đã được diễn tập.
- Cloud Run runtime chỉ bị xóa sau cutover thành công; Cloud SQL data vẫn được bảo vệ.

## 19. Thứ tự bắt đầu thực hiện

Thực hiện theo ba pull request đầu tiên, không gom toàn bộ migration vào một thay đổi lớn:

1. PR platform: foundation APIs/IAM + `gke-platform`, apply cluster và xác minh `kubectl`.
2. PR workload: refactor Helm cho external Cloud SQL/Secret Manager/Gateway, kiểm tra local và render GKE.
3. PR app: `gke-app`, Helm release, internal smoke test; sau đó mới làm DNS/TLS và cutover.

Điểm bắt đầu tiếp theo là PR platform. Chưa sửa hoặc destroy Cloud Run runtime trong PR này.
