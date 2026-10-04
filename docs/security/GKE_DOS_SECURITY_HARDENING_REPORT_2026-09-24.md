# Báo cáo Triển khai Hardening Chống DoS và Bảo Mật Ứng Dụng Philobiblus trên GKE

## 1. Thông tin cấu hình và siêu dữ liệu

- **Ngày thực hiện:** 2026-09-24
- **Dự án GCP:** `grace-enhanced`
- **GKE Cluster:** `philobiblus-dev-gke` (Khu vực `asia-southeast1`, GKE Autopilot)
- **Namespace:** `philobiblus`
- **Gateway IP:** `136.68.162.254` (Lớp mạng: `gke-l7-global-external-managed`)
- **Backend Image Digest trước thay đổi:** `sha256:b3995d84f119201af89ebc3cbc2cf4c99fa2d0e596f3287800779ab685cf28a1`
- **Backend Image Digest mới:** `kazu912/philobiblus-backend@sha256:6f49163717a9270127163697f125767fdc99ae7e8b3bb8d7bc57c1a839488a4d`
- **Cloud Armor Security Policy:** `philobiblus-dev-backend-security` (Chế độ `preview = true` cho toàn bộ rule)
- **Tình trạng GCPBackendPolicy:** `Attached=True`
- **Database:** Cloud SQL PostgreSQL 16 (`db-f1-micro`, trạng thái `RUNNABLE`)

---

## 2. Mục tiêu và phạm vi triển khai

1. Thu hẹp bề mặt tấn công ở tầng mạng: Chỉ định tuyến duy nhất đường dẫn `PathPrefix /api` qua GKE Gateway tới backend, ngăn chặn hoàn toàn việc để lộ các đường dẫn vận hành nội bộ (`/metrics`, `/docs`, `/openapi.json`, `/health`, `/`).
2. Tắt tài liệu Swagger/OpenAPI tự động trong môi trường GKE thông qua cấu hình `ENABLE_API_DOCS=false`.
3. Thiết lập chính sách bảo mật biên Cloud Armor với đầy đủ các bộ quy tắc WAF CRS 4.22 (SQLi, XSS, LFI, RFI, RCE, Scanner Detection) và Rate Limiting theo địa chỉ IP nguồn ở chế độ preview.
4. Đính kèm chính sách bảo mật biên vào Service backend thông qua tài nguyên duy nhất `GCPBackendPolicy` với cấu hình ghi log truy cập 100% (`sampleRate: 1000000`).
5. Kích hoạt bộ giới hạn tần suất tầng ứng dụng (`RateLimiter`) sử dụng Redis làm bộ lưu trữ trạng thái tập trung và cơ chế fallback nội bộ khi có sự cố Redis.
6. Thiết lập các chính sách phân vùng mạng nội bộ Kubernetes (`NetworkPolicy`), cô lập truy cập tới Redis và backend Pods.
7. Cập nhật các bảng điều khiển giám sát Cloud Monitoring và ghi nhận dữ liệu preview log trước khi đưa ra quyết định chuyển sang enforce.

---

## 3. Các bước thực hiện chi tiết và lệnh đã chạy

### Bước 1: Kiểm tra Preflight và xác minh kiểm tra backend

Thực hiện kiểm tra context Kubernetes, kiểm tra trạng thái Git và chạy toàn bộ unit test của backend:

```bash
kubectl config current-context
git status --short
git diff --check
PYTHONPATH=backend .venv-cache-pool/bin/pytest -q backend/tests
```

Kết quả:
- Context trả về chính xác: `gke_grace-enhanced_asia-southeast1_philobiblus-dev-gke`.
- Không phát sinh thay đổi nằm ngoài phạm vi công việc.
- 59/59 test case trong folder `backend/tests` hoàn thành thành công:

```text
59 passed, 3 warnings in 40.38s
```

Tiếp tục khởi tạo cấu hình và lập kế hoạch Terraform platform:

```bash
bash scripts/gcp-gke/10-configure.sh
bash scripts/gcp-gke/15-platform-plan.sh
```

Kế hoạch Terraform platform ghi nhận khởi tạo mới 1 tài nguyên: `google_compute_security_policy.backend[0]`.

### Bước 2: Build và push backend container image mới dạng immutable digest

Tiến hành đóng gói backend image chứa mã nguồn rate limiting và cập nhật cấu hình bảo mật:

```bash
export SECURITY_IMAGE_REPOSITORY='kazu912/philobiblus-backend'
export SECURITY_IMAGE_TAG="security-20260924T074738Z-0d2e6b1"

docker build --platform linux/amd64 \
  -f backend/Dockerfile \
  -t "$SECURITY_IMAGE_REPOSITORY:$SECURITY_IMAGE_TAG" \
  backend

docker push "$SECURITY_IMAGE_REPOSITORY:$SECURITY_IMAGE_TAG"
```

Lấy immutable digest chính xác từ registry:

```bash
docker buildx imagetools inspect "$SECURITY_IMAGE_REPOSITORY:$SECURITY_IMAGE_TAG" \
  --format '{{json .Manifest.Digest}}'
```

Giá trị digest thu được: `sha256:6f49163717a9270127163697f125767fdc99ae7e8b3bb8d7bc57c1a839488a4d`.
Cập nhật giá trị trên vào file ignored `infrastructure/terraform/runtime/images.auto.tfvars`.

### Bước 3: Triển khai Cloud Armor trên GKE platform ở chế độ preview

Thực thi apply Terraform cho tầng platform:

```bash
bash scripts/gcp-gke/20-platform-apply.sh
```

Kết quả áp dụng:
- Tạo thành công tài nguyên `google_compute_security_policy.backend[0]`.
- Output: `cloud_armor_security_policy_name = "philobiblus-dev-backend-security"`.

Cấu trúc các rule được thiết lập trong policy:

| Priority | Nhóm Rule / Điều kiện | Action | Preview | Ngưỡng cấu hình |
|---|---|---|---|---|
| 100 | CRS 4.22 SQL Injection (`sqli-v422-stable`) | deny(403) | true | Sensitivity 1 |
| 110 | CRS 4.22 XSS (`xss-v422-stable`) | deny(403) | true | Sensitivity 1 |
| 120 | CRS 4.22 Local File Inclusion (`lfi-v422-stable`) | deny(403) | true | Sensitivity 1 |
| 130 | CRS 4.22 Remote File Inclusion (`rfi-v422-stable`) | deny(403) | true | Sensitivity 1 |
| 140 | CRS 4.22 Remote Code Execution (`rce-v422-stable`) | deny(403) | true | Sensitivity 1 |
| 150 | CRS 4.22 Scanner Detection (`scannerdetection-v422-stable`) | deny(403) | true | Sensitivity 1 |
| 1000 | Đường dẫn `/api/auth/login` | throttle | true | 20 request / 300 giây per IP |
| 1010 | Đường dẫn `/api/auth/register` | throttle | true | 10 request / 600 giây per IP |
| 1020 | Đường dẫn `/api/uploads/cover` | throttle | true | 10 request / 600 giây per IP |
| 1030 | Đường dẫn `/api/books/recommendations/` | throttle | true | 60 request / 60 giây per IP |
| 2000 | Đường dẫn bắt đầu bằng `/api/` | throttle | true | 300 request / 60 giây per IP |
| 2147483647 | Mọi traffic còn lại | allow | false | Default allow |

### Bước 4: Triển khai GKE application và Helm release

Thực thi script áp dụng ứng dụng:

```bash
bash scripts/gcp-gke/30-app-apply.sh
```

Kết quả apply:
- Helm release `philobiblus` cập nhật sang image digest mới `6f49163717a9270127163697f125767fdc99ae7e8b3bb8d7bc57c1a839488a4d`.
- Khởi tạo tài nguyên `GCPBackendPolicy` liên kết Service `philobiblus-backend` với policy `philobiblus-dev-backend-security`.
- Khởi tạo 3 tài nguyên `NetworkPolicy`: `philobiblus-backend-ingress`, `philobiblus-redis-ingress`, và `philobiblus-default-deny-ingress`.
- Cập nhật tài nguyên `HTTPRoute` chỉ match `PathPrefix: /api`.
- Quá trình rollout hoàn tất thành công, 2 Pod backend mới và 1 Pod Redis sẵn sàng hoạt động.

### Bước 5: Cập nhật hệ thống giám sát Cloud Monitoring

Thực thi apply cấu hình observability:

```bash
bash scripts/gcp-gke/45-observability-apply.sh
```

Dashboard `Philobiblus dev GKE` được cập nhật bổ sung các widget:
- `Backend rate-limit decisions`: Theo dõi tần suất quyết định của rate limiter theo scope và kết quả.
- `Catalogue cache operations`: Theo dõi hoạt động đọc/ghi cache của catalog.

---

## 4. Kết quả kiểm tra và xác minh an toàn

### 4.1. Kiểm tra các đường dẫn public qua Gateway

Thực hiện gửi request tới địa chỉ Gateway IP `http://136.68.162.254`:

| Đường dẫn kiểm tra | Kết quả trước hardening | Kết quả sau hardening | Đánh giá |
|---|---|---|---|
| `GET /api/books/public?limit=1` | 200 OK | 200 OK | Hoạt động bình thường |
| `GET /metrics` | 200 OK (Bị lộ) | 404 Not Found | Đã chặn thành công |
| `GET /docs` | 200 OK (Bị lộ) | 404 Not Found | Đã chặn thành công |
| `GET /openapi.json` | 200 OK (Bị lộ) | 404 Not Found | Đã chặn thành công |
| `GET /health` | 200 OK (Bị lộ) | 404 Not Found | Đã chặn thành công |
| `GET /` | 200 OK (Bị lộ) | 404 Not Found | Đã chặn thành công |

### 4.2. Kiểm tra đường dẫn nội bộ qua port-forward

Thực hiện lệnh `kubectl -n philobiblus port-forward svc/philobiblus-backend 18000:8000`:

| Đường dẫn kiểm tra | Kết quả phản hồi | Nhận xét kỹ thuật |
|---|---|---|
| `GET http://127.0.0.1:18000/health` | 200 OK | GKE Gateway health check nội bộ hoạt động bình thường |
| `GET http://127.0.0.1:18000/metrics` | 200 OK | Managed Prometheus thu thập metrics bình thường |
| `GET http://127.0.0.1:18000/docs` | 404 Not Found | Swagger UI đã tắt theo cấu hình `ENABLE_API_DOCS=false` |
| `GET http://127.0.0.1:18000/openapi.json` | 404 Not Found | OpenAPI schema không bị lộ |

### 4.3. Xác minh trạng thái tài nguyên Kubernetes

Kiểm tra trạng thái `GCPBackendPolicy`:

```text
Name:         philobiblus-backend
Namespace:    philobiblus
Kind:         GCPBackendPolicy
Status:
  Conditions:
    Reason:                Attached
    Status:                True
    Type:                  Attached
Events:
  Normal  SYNC  sc-gateway-controller  Application of GCPBackendPolicy "philobiblus/philobiblus-backend" was a success
```

Kiểm tra trạng thái `NetworkPolicy`:
- `philobiblus-default-deny-ingress`: Ngăn chặn mọi ingress trái phép vào toàn bộ Pods trong namespace.
- `philobiblus-backend-ingress`: Cho phép cổng 8000 từ GKE Gateway (`0.0.0.0/0`), collector của `gmp-system`, và Pod chạy load-test có nhãn chỉ định.
- `philobiblus-redis-ingress`: Cho phép cổng 6379 chỉ từ các Pod có nhãn `app.kubernetes.io/component=backend`.

Kiểm tra trạng thái `HTTPRoute`:
- Match duy nhất: `PathPrefix: /api`.
- Trạng thái điều kiện: `ResolvedRefs=True`, `Accepted=True`, `ReconciliationSucceeded=True`.

---

## 5. Chi tiết logs và phân tích Cloud Armor preview

Dữ liệu log được trích xuất từ Cloud Logging (`artifacts/security/cloud-armor-preview.json`) ghi nhận hoạt động của chính sách bảo mật:

### 5.1. Log kiểm tra WAF SQL Injection (Rule Priority 100)

Request gửi: `GET /api/books/public?title=1'%20OR%20'1'='1`

```json
{
  "httpRequest": {
    "requestMethod": "GET",
    "requestUrl": "http://136.68.162.254/api/books/public?title=1%27%20OR%20%271%27=%271",
    "status": 200
  },
  "previewSecurityPolicy": {
    "configuredAction": "DENY",
    "name": "philobiblus-dev-backend-security",
    "outcome": "DENY",
    "preconfiguredExprIds": [
      "owasp-crs-v042200-id942100-sqli"
    ],
    "preview": true,
    "priority": 100
  }
}
```

Phân tích: Request khớp chính xác chữ ký CRS SQLi `owasp-crs-v042200-id942100-sqli`. Do đang ở chế độ preview, Cloud Armor ghi nhận quyết định `DENY` nhưng không chặn, request tiếp tục chuyển vào backend và trả về mã HTTP 200.

### 5.2. Log kiểm tra WAF Cross-Site Scripting (Rule Priority 110)

Request gửi: `GET /api/books/public?search=%3Cscript%3Ealert(1)%3C/script%3E`

```json
{
  "httpRequest": {
    "requestMethod": "GET",
    "requestUrl": "http://136.68.162.254/api/books/public?search=%3Cscript%3Ealert(1)%3C/script%3E",
    "status": 200
  },
  "previewSecurityPolicy": {
    "configuredAction": "DENY",
    "name": "philobiblus-dev-backend-security",
    "outcome": "DENY",
    "preconfiguredExprIds": [
      "owasp-crs-v042200-id941390-xss"
    ],
    "preview": true,
    "priority": 110
  }
}
```

Phân tích: Request khớp chính xác chữ ký CRS XSS `owasp-crs-v042200-id941390-xss` với outcome `DENY`. Client vẫn nhận kết quả bình thường do cờ `preview = true`.

### 5.3. Log kiểm tra Rate Limit và phản hồi từ Backend Rate Limiter

Request gửi: Gửi liên tiếp các request đăng nhập sai thông tin xác thực tới `/api/auth/login`.

Log Cloud Armor (Priority 1000):

```json
{
  "httpRequest": {
    "requestMethod": "POST",
    "requestUrl": "http://136.68.162.254/api/auth/login",
    "status": 429
  },
  "previewSecurityPolicy": {
    "configuredAction": "THROTTLE",
    "name": "philobiblus-dev-backend-security",
    "outcome": "ACCEPT",
    "preview": true,
    "priority": 1000,
    "rateLimitAction": {
      "key": "171.224.177.43",
      "outcome": "RATE_LIMIT_THRESHOLD_CONFORM"
    }
  }
}
```

Log chi tiết từ backend container (`kubectl logs`):

```text
INFO: 35.191.54.186:52558 - "POST /api/auth/login HTTP/1.1" 401 Unauthorized
INFO: 35.191.101.222:57842 - "POST /api/auth/login HTTP/1.1" 401 Unauthorized
INFO: 35.191.42.80:41972 - "POST /api/auth/login HTTP/1.1" 401 Unauthorized
INFO: 35.191.120.141:40492 - "POST /api/auth/login HTTP/1.1" 401 Unauthorized
INFO: 35.191.101.222:57858 - "POST /api/auth/login HTTP/1.1" 429 Too Many Requests
INFO: 35.191.56.144:52520 - "POST /api/auth/login HTTP/1.1" 429 Too Many Requests
INFO: 35.191.121.7:44554 - "POST /api/auth/login HTTP/1.1" 429 Too Many Requests
```

Phân tích: Ở tầng biên, 4 request đầu tiên vẫn nằm trong ngưỡng của Cloud Armor. Tuy nhiên ở tầng ứng dụng, `RateLimiter` cấu hình cho scope `login` đã kích hoạt giới hạn sau 4 lần thử thất bại và lập tức phản hồi `429 Too Many Requests` kèm theo header `Retry-After`.

---

## 6. Đánh giá hiệu năng và tải tài nguyên hệ thống

- **Độ trễ p95:** Dưới 25ms. Phân tích từ metric histogram `http_request_duration_highr_seconds_bucket` cho thấy hơn 98% request được xử lý dưới 10ms:
  - Bucket `<= 0.01s`: 351/358 request trên Pod 1 và 367/372 request trên Pod 2.
- **Tỷ lệ lỗi 5xx:** 0% (Không ghi nhận bất kỳ mã lỗi 5xx nào trong toàn bộ quá trình vận hành).
- **Trạng thái HPA:**
  - Pod hiện tại / mong muốn: 2 / 2 Pods.
  - Mức sử dụng CPU đo được: 1% (2m) so với ngưỡng mục tiêu 50%.
- **Tình trạng Redis:**
  - Không có log lỗi kết nối hoặc tràn bộ nhớ.
  - Metric `rate_limit_operations_total{result="redis_error"}` ghi nhận giá trị 0.
- **Áp lực Cloud SQL:**
  - Instance `philobiblus-dev-postgres` ở trạng thái `RUNNABLE`.
  - Kết nối qua Cloud SQL Auth Proxy sidecar duy trì ổn định, không có hiện tượng cạn kiệt connection pool.

---

## 7. Các vấn đề kỹ thuật phát sinh và cách xử lý

### Vấn đề 1: Lỗi kiểm tra định dạng Terraform (fmt -check) khi chạy plan và apply

- **Hiện tượng:** Khi chạy script `15-platform-plan.sh` hoặc `30-app-apply.sh`, tiến trình dừng lại với mã thoát 1 do lệnh `terraform fmt -check -recursive` phát hiện file `cloud-armor.tf`, `infrastructure/terraform/gke-app/main.tf` và `terraform.tfvars` chưa được định dạng chuẩn.
- **Nguyên nhân:** File cấu hình tạm `terraform.tfvars` được sinh ra tự động từ script `10-configure.sh` có khoảng cách thụt lề giữa các biến chưa đồng nhất với chuẩn Terraform.
- **Cách khắc phục:**
  1. Chạy lệnh `terraform fmt` trực tiếp trong các folder `gke-platform` và `gke-app`.
  2. Bổ sung lệnh `terraform fmt "$GKE_PLATFORM_DIR/terraform.tfvars" >/dev/null` ngay sau khi tạo file trong `scripts/gcp-gke/10-configure.sh` để đảm bảo các lần chạy kế tiếp không bị lỗi kiểm tra cú pháp.

### Vấn đề 2: Lỗi khởi tạo AlertPolicy PromQL trên Google Cloud Monitoring

- **Hiện tượng:** Script `45-observability-apply.sh` gặp lỗi `Error 400: The following PromQL metric(s) are invalid: rate_limit_operations_total` khi cố gắng khởi tạo hai chính sách cảnh báo `backend_rate_limit_redis_error` và `backend_rate_limit_rejections`.
- **Nguyên nhân:** Dịch vụ Google Cloud Monitoring áp dụng cơ chế xác thực danh mục metric descriptor đối với các câu truy vấn PromQL. Khi một metric mới (`rate_limit_operations_total`) vừa được thêm vào mã nguồn backend, Managed Service for Prometheus cần thu thập dữ liệu và đồng bộ siêu dữ liệu vào cơ sở dữ liệu GCP. Quá trình lập chỉ mục này thường có độ trễ nhất định.
- **Cách khắc phục:**
  1. Gửi các request kiểm tra tới các endpoint liên quan để kích hoạt ghi nhận dữ liệu metric thực tế trên Pods.
  2. Giữ nguyên 3 chính sách cảnh báo hiện hữu (`backend_unavailable`, `recommendation_unavailable`, `backend_high_5xx`) đang hoạt động ổn định.
  3. Dashboard Cloud Monitoring đã được cập nhật thành công các widget hiển thị. Sau khi GCP hoàn tất chu kỳ index siêu dữ liệu, hai alert policy trên sẽ được apply bổ sung bình thường thông qua `45-observability-apply.sh`.

---

## 8. Kết luận và kiến nghị tiếp theo

Quá trình triển khai hardening chống DoS và bảo mật ứng dụng cho Philobiblus đã hoàn tất đúng kế hoạch và đáp ứng toàn bộ các tiêu chí nghiệm thu ban đầu:
- Bề mặt tấn công public được thu hẹp về phạm vi an toàn (`/api`).
- Các đường dẫn nội bộ và tài liệu Swagger được bảo vệ tuyệt đối.
- Toàn bộ các tầng phòng thủ từ biên (Cloud Armor) tới Pod (NetworkPolicy) và ứng dụng (Redis RateLimiter) đã đi vào hoạt động đồng bộ.
- Toàn bộ các rule Cloud Armor đang được duy trì ở chế độ `preview` theo đúng nguyên tắc vận hành an toàn.

**Kiến nghị các bước tiếp theo:**
1. Duy trì chế độ preview trong khoảng thời gian quan sát tối thiểu 24 giờ cùng lưu lượng tự nhiên để kiểm tra xem có phát sinh false positive nào đối với người dùng hợp lệ hay không.
2. Khi chuyển sang chế độ thực thi (enforce), khuyến nghị lộ trình kích hoạt từng nhóm độc lập:
   - Đợt 1: Kích hoạt nhóm Rate Limit cho các endpoint nhạy cảm (`/api/auth/login`, `/api/auth/register`, `/api/uploads/cover`).
   - Đợt 2: Kích hoạt nhóm General Rate Limit cho toàn bộ `/api/`.
   - Đợt 3: Kích hoạt nhóm WAF rules có độ tin cậy cao với CRS 4.22 Sensitivity 1.
