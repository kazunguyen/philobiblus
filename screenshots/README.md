# Phân tích chi tiết các Screenshot (Bằng chứng triển khai)

Thư mục này chứa các ảnh chụp màn hình minh họa cho quá trình triển khai hạ tầng Google Cloud (GKE, MLOps, Security) cho dự án `philobiblus`. Dưới đây là mô tả cực kỳ chi tiết, trích xuất tất cả text có trong từng ảnh để phục vụ việc kiểm tra của hệ thống (codex).

## I. Nhóm ảnh báo cáo chính (Có đánh số 01-11)

### 1. `01-gke-cluster-overview.png`
**Bối cảnh:** Giao diện chi tiết của GKE Cluster trên Google Cloud Console.
**Nội dung text trong ảnh:**
- **Tiêu đề:** Cluster details | Cùng các nút lệnh: Edit, History, Equivalent code
- **Tên cluster:** `philobiblus-dev-gke` (kèm icon dấu tick xanh lục báo hiệu trạng thái khỏe mạnh)
- **Các tab:** Overview (đang chọn), Details, Storage, Observability, Logs
- **Thông tin chính (dạng bảng):**
  - **Status:** Running
  - **Mode:** Autopilot
  - **Region:** asia-southeast1
  - **Endpoint:** 34.126.191.125

### 2. `02-gke-workloads-philobiblus.png`
**Bối cảnh:** Giao diện danh sách Workloads của GKE.
**Nội dung text trong ảnh:**
- **Tiêu đề/Menu:** Workloads | Refresh, Deploy, Create Job, Delete
- **Bộ lọc:** Cluster (dropdown), Namespace (dropdown) | Nút Reset, Save
- **Các tab:** Overview (đang chọn), Observability, Cost optimisation
- **Filter đang áp dụng:** `Is system object : False`, `Cluster : philobiblus-dev-gke`
- **Bảng dữ liệu Workloads:**
  - **Cột:** Name, Status, Type, Pods, Node type, Namespace, Cluster
  - Dòng 1: `mlflow` | OK (icon tick xanh) | Deployment | 1/1 | Autopilot-managed | `philobiblus-mlops` | `philobiblus-dev-gke`
  - Dòng 2: `philobiblus-backend` | OK (icon tick xanh) | Deployment | 2/2 | Autopilot-managed | `philobiblus` | `philobiblus-dev-gke`
  - Dòng 3: `philobiblus-recommendation` | OK (icon tick xanh) | Deployment | 1/1 | Autopilot-managed | `philobiblus` | `philobiblus-dev-gke`
  - Dòng 4: `philobiblus-redis` | OK (icon tick xanh) | Deployment | 1/1 | Autopilot-managed | `philobiblus` | `philobiblus-dev-gke`
  - Dòng 5: `philobiblus-retrain` | OK (icon tick xanh) | Cron Job | 0/1 | Autopilot-managed | `philobiblus-mlops` | `philobiblus-dev-gke`
  - Dòng 6: `philobiblus-seed` | OK (icon tick xanh) | Job | 0/1 | Autopilot-managed | `philobiblus` | `philobiblus-dev-gke`

### 3. `03-gke-gateway-resources.png`
**Bối cảnh:** Terminal chạy các lệnh `kubectl` kiểm tra tài nguyên mạng trong namespace `philobiblus`.
**Nội dung text trong ảnh:**
- Lệnh 1: `yungn@ThinkBook121024:philobiblus$ kubectl -n philobiblus get gateway,httproute`
  - Ghi nhận một thông báo lỗi timeout API: `E1002 23:01:28.634326 ... "Unhandled Error" err="couldn't get current server API group list: Get \"...\": context deadline exceeded..."`
  - Bảng GATEWAY:
    - NAME: `gateway.gateway.networking.k8s.io/philobiblus` | CLASS: `gke-l7-global-external-managed` | ADDRESS: `136.68.162.254` | PROGRAMMED: `True` | AGE: `11d`
  - Bảng HTTPROUTE:
    - NAME: `httproute.gateway.networking.k8s.io/philobiblus-backend` | HOSTNAMES: (trống) | AGE: `11d`
- Lệnh 2: `yungn@ThinkBook121024:philobiblus$ kubectl -n philobiblus get svc`
  - Dòng 1: NAME: `philobiblus-backend` | TYPE: `ClusterIP` | CLUSTER-IP: `34.118.224.152` | EXTERNAL-IP: `<none>` | PORT(S): `8000/TCP` | AGE: `11d`
  - Dòng 2: NAME: `philobiblus-recommendation` | TYPE: `ClusterIP` | CLUSTER-IP: `34.118.224.20` | EXTERNAL-IP: `<none>` | PORT(S): `8080/TCP` | AGE: `30h`
  - Dòng 3: NAME: `philobiblus-redis` | TYPE: `ClusterIP` | CLUSTER-IP: `34.118.224.45` | EXTERNAL-IP: `<none>` | PORT(S): `6379/TCP` | AGE: `8d`
- Lệnh 3: `yungn@ThinkBook121024:philobiblus$ kubectl -n philobiblus get hpa`
  - Bảng HPA: NAME: `philobiblus-backend-hpa` | REFERENCE: `Deployment/philobiblus-backend` | TARGETS: `cpu: 1%/50%` | MINPODS: `2` | MAXPODS: `6` | REPLICAS: `2` | AGE: `11d`
- Lệnh 4: `yungn@ThinkBook121024:philobiblus$ kubectl -n philobiblus get gcpbackendpolicy`
  - Bảng GCPBACKENDPOLICY: NAME: `philobiblus-backend` | AGE: `8d`

### 4. `04-cloud-monitoring-dashboard.png`
**Bối cảnh:** Cloud Monitoring Custom Dashboard hiển thị metrics của backend.
**Nội dung text trong ảnh:**
- **Tiêu đề Dashboard:** Philobiblus dev GKE (Có nút Add widget). Thanh công cụ: Annotations (2), Group by, Filter. Khung thời gian: Last 30 minutes, ICT.
- **Biểu đồ 1 (Góc trên trái):** "Scrape targets by component". Y-axis: 0 đến 6. Legend: `backend` (chấm xanh dương), `recommendation` (chấm xanh lá). Trục X (thời gian) từ 23:20 đến 23:45. Có đường đồ thị tăng vọt từ 0 lên mức 6 vào khoảng 23:33.
- **Biểu đồ 2 (Góc trên phải):** "Backend HTTP request rate". Y-axis: 0 đến 80. Lệnh truy vấn: `sum(rate(http_requests_total{namespace="philobiblus",cluster="philobiblus-dev-gke",component="backend"}[5m]))`. Đồ thị request rate đạt đỉnh quanh mức 70-75.
- **Biểu đồ 3 (Giữa trái):** "Backend HTTP 5xx ratio". Y-axis: 0 đến 0.004. Lệnh truy vấn: `sum(rate(http_requests_total{...status=~"5.."}[5m])) / clamp_min(...)`. Đồ thị đạt đỉnh gần mức 0.004.
- **Biểu đồ 4 (Giữa phải):** "Backend p95 request duration (seconds)". Y-axis: 0.02 đến 0.12. Lệnh truy vấn: `histogram_quantile(0.95, sum by (le) (rate(http_request_duration_highr_seconds_bucket...`. Đồ thị đạt đỉnh khoảng 0.12 giây.
- **Biểu đồ 5 (Dưới trái):** "Backend rate-limit decisions". Y-axis: 0 đến 2. Legend: `allowed login`, `allowed public_recommendation`, `rejected login`, `rejected public_recommendation`. Các đường biểu đồ đạt các đỉnh khác nhau (khoảng 1.8, 1.1, 0.8).
- **Biểu đồ 6 (Dưới phải):** "Catalogue cache operations". Y-axis: 0 đến 60. Legend: `hit get`, `miss get`, `success set`. Đồ thị "hit get" đạt đỉnh gần mức 60.

### 5. `05-cloud-logging-backend.png`
**Bối cảnh:** Giao diện Log Explorer (Cloud Logging) truy vấn log ứng dụng backend.
**Nội dung text trong ảnh:**
- **Thanh tìm kiếm:** Project logs | Search all fields | Nút: Run query.
- **Bộ lọc nhanh đang bật:** `Kubernetes container +3`, `All log names`, `All severities`, `Correlate by`.
- **Câu lệnh truy vấn (LQL):**
  1: `resource.type="k8s_container"`
  2: `resource.labels.project_id="grace-enhanced"`
  3: `resource.labels.cluster_name="philobiblus-dev-gke"`
  4: `resource.labels.namespace_name="philobiblus"`
  5: `resource.labels.container_name="backend"`
- **System metadata (Trái):** Severity: `Info` (3,570) | Cluster name: `philobiblus-dev-gke` | Container name: `backend` | Namespace name: `philobiblus` | Project ID: `grace-enhanced`.
- **Timeline:** Biểu đồ histogram cột dọc xanh dương nhạt cho thấy mật độ log khá đều từ mốc 22:24:00 đến 23:24:00.
- **Bảng dữ liệu Log (3,570 results):**
  - Cột: Severity, Time, Summary.
  - Các dòng kết quả đều mang nhãn INFO, ghi nhận các lượt gọi health check liên tục, ví dụ:
    - `2026-10-02 23:24:00.206` | `backend` | `INFO:` | `35.191.250.77:43668 - "GET /health HTTP/1.1" 200 OK`
    - `2026-10-02 23:24:00.947` | `backend` | `INFO:` | `169.254.4.6:52842 - "GET /health HTTP/1.1" 200 OK`

### 6. `06-cloud-sql-overview.png`
**Bối cảnh:** Màn hình Overview của instance Cloud SQL trên Google Cloud.
**Nội dung text trong ảnh:**
- **Đường dẫn:** All instances > `philobiblus-dev-postgres`
- **Tiêu đề:** `philobiblus-dev-postgres` (kèm icon tick xanh hoạt động tốt). Phụ đề: `PostgreSQL 16`
- **Thông tin cấu hình (Bảng ngang):**
  - Database version: `PostgreSQL 16.15`
  - Cloud SQL edition: `Enterprise`
  - Machine: `1 vCPU, 628.74 MB`
  - Region: `asia-southeast1`
  - Availability: `Single zone`
  - Nút bấm: View all configuration
- **Thanh tiến độ:** Learn the basics of Cloud SQL (0 of 3 completed).
- **Biểu đồ "Total connections":**
  - Trục X: Timeline hiển thị giờ từ 02:00 đến 22:00 (múi giờ UTC+7).
  - Trục Y: Hiển thị mốc 10, 20, 30.
  - Có vạch đứt màu đỏ: `Max. connections` ở mốc 30.
  - Đồ thị màu xanh biểu diễn lượng kết nối đa phần duy trì từ mức 10 đến 13, và có một đỉnh đột biến vọt lên khoảng mức 20 vào thời điểm sau 22:00.

### 7. `07-mlflow-experiment-runs.png`
**Bối cảnh:** Báo cáo chi tiết của một Experiment Run trong công cụ MLflow.
**Nội dung text trong ảnh:**
- **Đường dẫn:** philobiblus-content-recommender > Runs >
- **Tiêu đề Run:** `tfidf-v2-e485ba4d8bce-3d597c8`
- **Tabs:** Overview, Model metrics, System metrics, Traces, Artifacts. Description: `No description`
- **Panel bên phải "About this run":**
  - Created at: `10/01/2026, 03:00:24 AM`
  - Created by: `trainer`
  - Experiment ID: `1`
  - Status: `Finished` (màu xanh lá)
  - Run ID: `0b3fb750f54543f3abe5e710d7922490`
  - Duration: `9.5s`
  - Source: `mlflow_model.py`
  - Tags: `artifact_schema_version: 2`, `snapshot_sha256: e485ba4d8bcefff9b09dacf3499...`, `validation_status: insufficient_data`, `model_type: sparse-tfidf-cosine`
  - Registered models: `philobiblus-content-recommender` (phiên bản `v8`)
- **Phần "Metrics (11)":** Bảng gồm cột Metric, Value, Models
  - `hit_rate_at_5`: `0`
  - `recall_at_5`: `0`
  - `mrr_at_5`: `0`
  - `catalog_coverage_at_5`: `0`
  - `evaluated_profiles`: `0`
  - `catalog_size`: `100`
  - `vocabulary_size`: `2030`
  - `mean_top_k_similarity`: `0.17070663452161586`
  - `new_books`: `0`
  - `updated_books`: `0`
  - `removed_books`: `0`
- **Phần "Parameters (4)":** Bảng gồm cột Parameter, Value
  - `snapshot_id`: `catalog-e485ba4d8bcefff9b09d`
  - `git_sha`: `3d597c8accd6-dirty-bootstrap-safe`
  - `training_image_digest`: `sha256:cad691b6d43a11eaaaf2ccd4b90a6019f841fb4c858b537abf5bb4a622128e4a`
  - `model_release_version`: `tfidf-v2-e485ba4d8bce-3d597c8`

### 8. `08-gke-retrain-workloads.png`
**Bối cảnh:** Lịch sử thực thi (log chạy) của quá trình huấn luyện lại mô hình (retrain job) trên GKE.
**Nội dung text trong ảnh:**
- **Dạng bảng danh sách, chứa 1 dòng duy nhất.**
- Cột Status: `Completed` (icon tick xanh lá tròn)
- Cột Job name: `philobiblus-retrain-29849520`
- Cột Type: `Kubernetes`
- Cột Namespace: `philobiblus-mlops`
- Cột Cluster: `philobiblus-dev-gke`
- Cột Created on: `3 Oct 2026, 03:00:00`
- Cột Duration: `36 sec`
- Cột Location: `asia-southeast1`

### 9. `09-gcs-mlops-artifacts.png`
**Bối cảnh:** Màn hình Cloud Storage hiển thị root folder của bucket lưu artifacts.
**Nội dung text trong ảnh:**
- **Đường dẫn:** Buckets > `grace-enhanced-philobiblus-mlops`
- Các nút công cụ cơ bản: Create folder, Upload, Transfer data.
- **Bảng file/thư mục hiển thị 4 folder chính:**
  - `mlflow/` | Type: `Folder`
  - `models/` | Type: `Folder`
  - `releases/` | Type: `Folder`
  - `snapshots/` | Type: `Folder`
- (Các cột Size và Created hiện dấu `—` do giao diện dạng ảo).

### 10. `10-cloud-armor-policy.png`
**Bối cảnh:** Trang chi tiết cấu hình policy của Google Cloud Armor (bảo vệ ứng dụng backend).
**Nội dung text trong ảnh:**
- **Tiêu đề lớn:** `philobiblus-dev-backend-security`
- **Thông tin cơ bản:**
  - Type: `Backend security policy`
  - Description: `Philobiblus backend Cloud Armor WAF and rate limits.`
  - Scope: `global`
- **Mục con:** Contains: `12 rules`, Applies to: `1 target`.
- **Danh sách 12 rules (Sắp xếp theo priority từ thấp đến cao):**
  1. Priority `100` | Action `Deny (403)` | Match `evaluatePreconfiguredWaf('sqli-v422-stable', {'sensitivity': 1})` | Desc: `CRS 4.22 SQL injection protection.`
  2. Priority `110` | Action `Deny (403)` | Match `evaluatePreconfiguredWaf('xss-v422-stable', {'sensitivity': 1})` | Desc: `CRS 4.22 XSS protection.`
  3. Priority `120` | Action `Deny (403)` | Match `evaluatePreconfiguredWaf('lfi-v422-stable', {'sensitivity': 1})` | Desc: `CRS 4.22 local file inclusion protection.`
  4. Priority `130` | Action `Deny (403)` | Match `evaluatePreconfiguredWaf('rfi-v422-stable', {'sensitivity': 1})` | Desc: `CRS 4.22 remote file inclusion protection.`
  5. Priority `140` | Action `Deny (403)` | Match `evaluatePreconfiguredWaf('rce-v422-stable', {'sensitivity': 1})` | Desc: `CRS 4.22 remote code execution protection.`
  6. Priority `150` | Action `Deny (403)` | Match `evaluatePreconfiguredWaf('scannerdetection-v422-stable', {'sensitivity': 1})` | Desc: `CRS 4.22 scanner detection.`
  7. Priority `1,000` | Action `Throttle` | Match `request.path == '/api/auth/login'` | Desc: `Limit login attempts by client IP.`
  8. Priority `1,010` | Action `Throttle` | Match `request.path == '/api/auth/register'` | Desc: `Limit account registrations by client IP.`
  9. Priority `1,020` | Action `Throttle` | Match `request.path == '/api/uploads/cover'` | Desc: `Limit expensive cover uploads by client IP.`
  10. Priority `1,030` | Action `Throttle` | Match `request.path.startsWith('/api/books/recommendations/') || request.path.endsWith('/recommendations')` | Desc: `Limit recommendation requests by client IP.`
  11. Priority `2,000` | Action `Throttle` | Match `request.path.startsWith('/api/')` | Desc: `General per-IP API flood protection.`
  12. Priority `2,147,483,647` | Action `Allow` | Match `* (All IP addresses)` | Desc: `Default allow for traffic that matches no higher-priority rule.`

### 11. `11-ui-public-catalog.png`
**Bối cảnh:** Giao diện trang frontend (Dashboard công khai) của ứng dụng Philobiblus.
**Nội dung text trong ảnh:**
- **URL trình duyệt:** `https://kazunguyen.github.io/philobiblus/dashboard`
- **Navbar (Menu trên cùng):** Logo `Philobiblus`, các nút điều hướng `Dashboard`, `Statistics`, `Books`, `Social`. Avatar người dùng với chữ `US`.
- **Tiêu đề chính:** `Public Dashboard`
- **Mô tả:** `Explore books shared by readers across Philobiblus.`
- **Khu vực tìm kiếm (Find books):** Ô nhập "Search by title or author", Ô "Filter by genre", Nút `Search` màu đen.
- **Cột "For you" (Gợi ý riêng, bên trái):**
  - Ảnh bìa cuốn sách: `Pony Pals` (The Pony and the Bear) của `JEANNE BETANCOURT`. Logo `SCHOLASTIC`.
  - Tên sách hiển thị: `The Pony and the Bear`
  - Nút chức năng: `Want to Read`
  - Badge (thể loại/trạng thái): `Publishing completed`, `Animals`, `Horses`, `Childrens`, `Fiction`.
  - Thông tin đi kèm: `0 reading`, `Author: Jeanne Betancourt`, `Rating: ` (chưa có sao nào được tô đen).
- **Vùng "Public books" (Danh mục công khai):**
  - Sách 1:
    - Ảnh bìa: `HAWAII An Uncommon History`, `EDWARD JOESTING`.
    - Tên hiển thị: `Hawaii: An Uncommon History`
    - Badges: `Reading`, `Publishing completed`, `History`, `Nonfiction`.
    - Lượt tương tác: `1 reading`
    - Author: `Edward Joesting`
    - Rating: 4/5 sao.
    - Footer links: `View details`, `View profile`
  - Sách 2:
    - Ảnh bìa: Một phần máy bay/khí cầu khổng lồ, nhan đề `R101 A PICTORIAL HISTORY`, `NICK LE NEVE WALMSLEY`.
    - Tên hiển thị: `R101: A Pictorial History`
    - Badges: `Want to Read`, `Publishing completed`, `Uncategorized`.
    - Lượt tương tác: `0 reading`
    - Author: `Nick Le Neve Walmsley`
    - Rating: 5/5 sao.
    - Footer links: `View details`, `View profile`
  - Sách 3:
    - Ảnh bìa: Bức tranh phong cách Phật giáo mandala, `GENUINE HAPPINESS Meditation as the Path to Fulfillment`, `B. ALAN WALLACE`.
    - Tên hiển thị: `Genuine Happiness: Meditation as the Path to Fulfillment`
    - Badges: `Completed`, `Publishing completed`, `Religion`, `Buddhism`, `Philosophy`, `Spirituality`, `Psychology`, `Nonfiction`.
    - Lượt tương tác: `0 reading`
    - Author: `B. Alan Wallace, Dalai Lama XIV`
    - Rating: 4/5 sao.
    - Footer links: `View details`, `View profile`

---

## II. Nhóm ảnh bổ sung (Không đánh số, thuộc pha Bootstrap/Foundation)

*Ghi chú: Các ảnh này ghi lại trạng thái hạ tầng ban đầu, thường đóng vai trò đối chiếu tham khảo.*

| File | Nội dung chính có thể quan sát (Tóm tắt) |
| --- | --- |
| `gcloud-bucket-state.png` | Bucket Terraform state `grace-enhanced-tfstate-6515597414`, khu vực `ASIA-SOUTHEAST1`. |
| `gcloud-vpc-subnet.png` | Subnet `philobiblus-dev-run` của VPC `philobiblus-dev-vpc`, dải IP `10.20.0.0/24`. |
| `gcloud-vpc-private-service-access.png` | Kết nối Private Service Access tới `servicenetworking.googleapis.com`. |
| `gcloud-sql-postgres.png` | Instance `philobiblus-dev-postgres` chạy bình thường tại `asia-southeast1`. |
| `gcloud-sql-database-philobiblus.png` | Danh sách database bên trong instance, cho thấy có database tên `philobiblus`. |
| `gcloud-artifact-registry.png` | Giao diện Artifact Registry, có repository tên `philobiblus`. |
| `gcloud-service-account.png` | Danh sách Service Account, hiển thị các IAM Identity như `philobiblus-backend`, `philobiblus-recommend`, `philobiblus-seed`. |
| `gcloud-secret-manager.png` | Giao diện Secret Manager, hiển thị cấu hình các secret cho database, JWT, và external API key. |
| `dashboard-after-stress-test.png` | Giao diện frontend của ứng dụng sau quá trình kiểm tra tải. |
