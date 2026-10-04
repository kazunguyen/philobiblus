# Triển khai observability Philobiblus trên GKE

> Mục tiêu: quan sát metrics, logs, dashboard và alerts cho workload Philobiblus trên GKE Autopilot mà không triển khai thêm một Prometheus/Grafana stack tự quản lý trong cluster. Tài liệu này tách biệt với observability local tại `monitoring/`.

## 1. Kiến trúc được chọn

```text
backend Pod /metrics -----------+
recommendation Pod /metrics ----+--> Google Managed Service for Prometheus
                                         managed collector -> Monarch
GKE workload stdout/stderr -----------------------------> Cloud Logging
Cloud SQL / GKE managed metrics ------------------------> Cloud Monitoring
Monarch + Cloud Monitoring -----------------------------> Metrics Explorer
                                             |          -> Cloud Monitoring dashboard
                                             +----------> PromQL alert policies -> email channel
```

Không cài `kube-prometheus-stack`, Prometheus server, Alertmanager hay Grafana server vào GKE Autopilot cho môi trường này. Các thành phần đó đang phù hợp với cluster local; cài thêm vào GKE sẽ tạo hai collector cùng scrape một endpoint, tăng chi phí và thêm storage/upgrade phải vận hành.

Google Managed Service for Prometheus (GMP) là lựa chọn phù hợp vì managed collection tự chạy collector trong GKE, push dữ liệu vào Monarch và query được bằng PromQL trong Cloud Monitoring. GKE Autopilot từ phiên bản 1.25 đã bật managed collection mặc định; cluster hiện còn bật rõ `managed_prometheus { enabled = true }` trong `gke-platform`. [Managed collection on GKE](https://cloud.google.com/stackdriver/docs/managed-prometheus/setup-managed)

## 2. So sánh local và GKE

| Năng lực | Local k3d | GKE Autopilot |
| --- | --- | --- |
| Scrape | Prometheus Operator đọc `ServiceMonitor` | GMP đọc `PodMonitoring` (`monitoring.googleapis.com/v1`) |
| Lưu/query metrics | Prometheus Pod local | Monarch/Cloud Monitoring, query PromQL toàn project |
| Dashboard | Grafana + `monitoring/grafana-dashboard.json` | Cloud Monitoring dashboard; có thể import Grafana JSON sau khi chỉnh query |
| Alert rule | `PrometheusRule` (`monitoring.coreos.com/v1`) | `google_monitoring_alert_policy` PromQL bằng Terraform, hoặc `Rules` GMP CR |
| Alert notification | Alertmanager local | Cloud Monitoring notification channel |
| PostgreSQL alert | PVC usage | Cloud SQL instance metrics; GKE không chạy PostgreSQL PVC |
| Logs | `kubectl logs` | Cloud Logging, tự thu stdout/stderr workload |

`monitoring/prometheus-values.yaml`, `ServiceMonitor`, `PrometheusRule` và dashboard local không được apply nguyên xi lên GKE. `gke-app` đã đúng khi đặt `serviceMonitor.enabled=false`, `prometheusRule.enabled=false`, `podMonitoring.enabled=true`.

## 3. Những phần đã có trong repository

| Thành phần | Tình trạng | Vai trò |
| --- | --- | --- |
| `backend/app/main.py` | Có | Expose Prometheus `/metrics`; không public qua Gateway. |
| `ml/recommendation-service/app/main.py` | Có | Expose `/metrics`, thêm `philobiblus_recommendation_requests_total` và `philobiblus_recommendation_model_info`. |
| `kubernetes/helm/philobiblus/templates/podmonitoring.yaml` | Có | Tạo PodMonitoring backend và recommendation, scrape named port `http`, path `/metrics`, interval 30s. |
| `infrastructure/terraform/gke-platform/main.tf` | Có | Bật managed Prometheus, GKE logging và Monitoring components. |
| `infrastructure/terraform/gke-app/main.tf` | Có | Bật `monitoring.podMonitoring` khi Helm release chạy trên GKE. |
| `docs/monitoring/alert-runbooks.md` | Có, cần tách nội dung | Runbook backend còn dùng được; phần PostgreSQL PVC không dùng cho GKE. |
| Dashboard/alert policy Cloud Monitoring | Chưa có IaC | Cần triển khai theo các bước bên dưới. |

## 4. Giai đoạn A — xác minh ingestion trước khi thêm dashboard/alert

Chạy sau khi `gke-platform` và `gke-app` đã apply:

```bash
cd /mnt/d/JUNIOR/SEMESTER2/Thuc-tap/JITS_INNO_Labs/devops-training-NguyenQuangDung/phase-2/track-mlops-security/philobiblus

export PROJECT_ID="grace-enhanced"
export REGION="asia-southeast1"
export CLUSTER_NAME="philobiblus-dev-gke"
export NAMESPACE="philobiblus"

gcloud container clusters get-credentials "$CLUSTER_NAME" \
  --region="$REGION" --project="$PROJECT_ID"

kubectl get podmonitoring -n "$NAMESPACE"
kubectl get pods -n "$NAMESPACE" -l app.kubernetes.io/component=backend
kubectl get pods -n "$NAMESPACE" -l app.kubernetes.io/component=recommendation
kubectl get namespaces | rg 'gmp|monitoring'
```

Kiểm tra metric endpoint trực tiếp trước. Lệnh này không public `/metrics`:

```bash
kubectl port-forward -n "$NAMESPACE" service/philobiblus-backend 18000:8000
curl -fsS http://127.0.0.1:18000/metrics | rg 'http_requests_total|http_request_duration'
```

Sau vài phút, vào **Cloud Monitoring > Metrics Explorer**, đổi query mode sang **PromQL**, chạy lần lượt:

```promql
up{namespace="philobiblus"}
```

```promql
http_requests_total{namespace="philobiblus"}
```

```promql
philobiblus_recommendation_model_info{namespace="philobiblus"}
```

GMP tự thêm các target labels `project_id`, `location`, `cluster`, `namespace`, `job`, `instance`. Không giả định label `service` từ Prometheus local vẫn tồn tại; chỉ dùng label đã thấy trong Metrics Explorer hoặc label do `targetLabels` khai báo. [Reserved labels và PodMonitoring](https://cloud.google.com/stackdriver/docs/managed-prometheus/setup-managed)

Điều kiện hoàn thành Giai đoạn A: cả hai `PodMonitoring` tồn tại, `up` có target backend/recommendation, metrics ứng dụng xuất hiện trong Metrics Explorer và logs workload tìm được trong Cloud Logging.

## 5. Giai đoạn B — chuẩn hóa labels để dashboard/alerts ổn định

Hiện dashboard local lọc `service="philobiblus-backend"`. Đây là label của cách scrape local bằng ServiceMonitor, không phải contract nên dùng cho GMP. Gemini cần bổ sung label bounded `component` vào hai PodMonitoring trước khi viết query:

```yaml
spec:
  selector:
    matchLabels:
      app.kubernetes.io/component: backend
  targetLabels:
    fromPod:
      - from: app.kubernetes.io/component
        to: component
  endpoints:
    - port: http
      path: /metrics
      interval: 30s
```

Recommendation dùng cùng `targetLabels`, với component có giá trị `recommendation`. Không copy label dynamic như user ID, book ID, email, URL đầy đủ, token hoặc request body thành Prometheus label; chúng làm tăng cardinality và có thể lộ dữ liệu.

Sau update chart, chạy:

```bash
helm lint kubernetes/helm/philobiblus
helm template philobiblus kubernetes/helm/philobiblus \
  --set monitoring.podMonitoring.enabled=true > /tmp/philobiblus-gmp.yaml
rg -n 'kind: PodMonitoring|targetLabels|component|path: /metrics' /tmp/philobiblus-gmp.yaml

bash scripts/gcp-gke/30-app-apply.sh
```

Sau collector scrape vòng tiếp theo, xác nhận:

```promql
sum by (component) (up{namespace="philobiblus"})
```

## 6. Giai đoạn C — dashboard Cloud Monitoring

Tạo một Terraform root module mới `infrastructure/terraform/gke-observability/`, state prefix `philobiblus/gke-observability`. Module này chỉ quản lý Cloud Monitoring dashboards, notification channels và alert policies; không quản lý cluster hay Helm release. Tách state giúp thay dashboard/threshold mà không làm plan thay GKE hoặc application release.

### Inputs và guardrails

```hcl
variable "project_id" { type = string }
variable "environment" { type = string }
variable "cluster_name" { type = string }
variable "namespace" { type = string  default = "philobiblus" }
variable "alert_email" {
  type        = string
  description = "Operations notification email; set only in ignored terraform.tfvars."
}
```

`terraform.tfvars.example` phải dùng `ops@example.com`; file thật bị Git ignore. Reuse bucket của bootstrap và tạo `backend.tf` với prefix `philobiblus/gke-observability`.

Tạo `google_monitoring_dashboard.philobiblus` bằng JSON được kiểm soát trong Git. Dashboard tối thiểu:

| Panel | PromQL |
| --- | --- |
| Healthy targets | `sum by (component) (up{namespace="philobiblus"})` |
| Backend request rate | `sum(rate(http_requests_total{namespace="philobiblus",component="backend"}[5m]))` |
| Backend 5xx ratio | `sum(rate(http_requests_total{namespace="philobiblus",component="backend",status=~"5.."}[5m])) / clamp_min(sum(rate(http_requests_total{namespace="philobiblus",component="backend"}[5m])), 0.001)` |
| Backend p95 latency | `histogram_quantile(0.95, sum by (le) (rate(http_request_duration_highr_seconds_bucket{namespace="philobiblus",component="backend"}[5m])))` |
| Recommendation outcomes | `sum by (outcome) (rate(philobiblus_recommendation_requests_total{namespace="philobiblus",component="recommendation"}[5m]))` |
| Model version | `max by (model_version) (philobiblus_recommendation_model_info{namespace="philobiblus",component="recommendation"})` |
| GKE resources | CPU, memory, restart count và HPA replica từ Cloud Monitoring/GKE system metrics |
| Cloud SQL | CPU, connections, storage and database availability from Cloud SQL metrics |

Metric `http_request_duration_highr_seconds_bucket` phải được kiểm chứng trong Metrics Explorer trước khi đưa vào policy, vì dashboard local hiện có sẵn query này và metric names là contract của instrumentator version. Nếu không xuất hiện, sửa query theo endpoint `/metrics`, không đoán tên metric.

Có thể thử import `monitoring/grafana-dashboard.json` vào Cloud Monitoring, nhưng không coi đó là source of truth: importer chỉ hỗ trợ Grafana JSON có PromQL/Prometheus datasource và kết quả có thể khác dashboard gốc. Sau khi import thành công, export/chuyển JSON phù hợp vào `gke-observability` để Terraform quản lý. [Import Grafana dashboards into Cloud Monitoring](https://cloud.google.com/stackdriver/docs/managed-prometheus/import-grafana-dashboards)

## 7. Giai đoạn D — alerting và notification

### Chọn Cloud Monitoring PromQL policies

Dùng `google_monitoring_notification_channel` cho email và `google_monitoring_alert_policy` với `condition_prometheus_query_language`. Đây là đường production cho GKE: policy/recipient nằm trong IaC, alert không phụ thuộc Alertmanager tự quản lý trong cluster.

Mẫu field Terraform:

```hcl
resource "google_monitoring_alert_policy" "backend_unavailable" {
  display_name         = "Philobiblus ${var.environment}: backend unavailable"
  combiner             = "OR"
  notification_channels = [google_monitoring_notification_channel.operations.name]

  conditions {
    display_name = "No healthy backend target"
    condition_prometheus_query_language {
      query               = "sum(up{namespace=\"${var.namespace}\",component=\"backend\"}) < 1"
      duration            = "120s"
      evaluation_interval = "30s"
      alert_rule          = "PhilobiblusBackendUnavailable"
      rule_group          = "philobiblus.gke"
    }
  }

  alert_strategy { auto_close = "1800s" }
}
```

Tạo trước bốn policy sau, sau khi query từng biểu thức trong Metrics Explorer:

1. `backend unavailable`: `sum(up{namespace="philobiblus",component="backend"}) < 1` trong 2 phút, severity critical.
2. `backend high 5xx ratio`: ratio 5xx lớn hơn `0.05` trong 5 phút, severity warning.
3. `backend p95 latency`: p95 lớn hơn `1` second trong 5 phút, severity warning.
4. `recommendation unavailable`: `sum(up{namespace="philobiblus",component="recommendation"}) < 1` trong 5 phút, severity warning.

Không migrate nguyên `PrometheusRule` local:

- `ServiceMonitor`/`PrometheusRule` yêu cầu Prometheus Operator CRDs mà GKE managed collection không dùng.
- threshold backend local giả định min replica `3`, còn GKE `gke-app` đặt HPA min `1`.
- PostgreSQL PVC alert không áp dụng vì database production là Cloud SQL, không có PVC in-cluster.

GMP cũng có `Rules` CR tương thích Prometheus rule format và managed rule evaluator, nhưng sử dụng Cloud Monitoring alert policies trước để email channels, incident lifecycle và Terraform ownership rõ ràng. [Managed rule evaluation and alerting](https://cloud.google.com/stackdriver/docs/managed-prometheus/rules-managed) và [Terraform alert policy PromQL](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/monitoring_alert_policy).

### Apply và kiểm chứng notification

```bash
terraform -chdir=infrastructure/terraform/gke-observability init \
  -backend-config="bucket=$STATE_BUCKET_NAME"
terraform -chdir=infrastructure/terraform/gke-observability fmt -check -recursive
terraform -chdir=infrastructure/terraform/gke-observability validate
terraform -chdir=infrastructure/terraform/gke-observability plan -out=gke-observability.tfplan
terraform -chdir=infrastructure/terraform/gke-observability apply gke-observability.tfplan
```

Xác nhận email channel trong Cloud Monitoring và diễn tập một alert có kiểm soát ở dev: scale backend về 0 trong vài phút, nhận incident/notification, scale về số replica cũ, sau đó xác nhận alert đóng. Không xoá Pod, data hoặc Cloud SQL để test alert.

## 8. Logs, health và runbook

GKE logging đang enabled trong `gke-platform`, nên container stdout/stderr được Cloud Logging thu thập. Query Logs Explorer cơ bản:

```text
resource.type="k8s_container"
resource.labels.cluster_name="philobiblus-dev-gke"
resource.labels.namespace_name="philobiblus"
```

Tách query theo `resource.labels.container_name` cho backend, recommendation hoặc cloud-sql-proxy. Không log JWT, `Authorization` header, database URL/password hay secret value. Bước cải thiện tiếp theo là đổi backend/recommendation sang JSON structured logs có request ID, route template, status, latency và error class; không log payload/user data.

Cập nhật `docs/monitoring/alert-runbooks.md` thành hai phần:

- runbook backend/recommendation dùng được ở cả local và GKE, với commands `kubectl logs`, `kubectl get hpa`, Cloud Logging query và Metrics Explorer link;
- runbook Cloud SQL dành GKE thay cho PostgreSQL PVC usage.

Mỗi alert policy có `documentation` chứa link runbook GitHub, dashboard URL và câu query cần dùng để triage.

## 9. Thứ tự thực hiện đề xuất

1. Apply/verify GKE app để PodMonitoring và `/metrics` có data trong GMP.
2. Thêm bounded `component` target label; apply Helm release và kiểm tra PromQL.
3. Tạo `gke-observability` module: dashboard trước, alert policies/email sau.
4. Diễn tập alert backend unavailable trong dev và cập nhật runbook theo bằng chứng thật.
5. Bổ sung dashboard/query Cloud SQL và GKE resource health.
6. Chỉ khi Cloud Monitoring dashboard thiếu chức năng cần thiết mới deploy Grafana riêng và cấu hình datasource đọc GMP/Monarch; không để Grafana query một Prometheus Pod local.

## 10. Definition of done

- [ ] `up` hiển thị target backend và recommendation trong Cloud Monitoring PromQL.
- [ ] `/metrics` không public qua Gateway, nhưng PodMonitoring scrape được cả hai service.
- [ ] Dashboard GKE được Terraform quản lý, có application, GKE và Cloud SQL panels.
- [ ] Có email notification channel và bốn alert policies PromQL được Terraform quản lý.
- [ ] Đã diễn tập một alert từ metric đến notification rồi recovery.
- [ ] Cloud Logging query được backend/recommendation/Cloud SQL proxy logs và không chứa secret.
- [ ] Local `ServiceMonitor`/`PrometheusRule` không được bật trong GKE values; Cloud SQL alert thay PVC alert.
