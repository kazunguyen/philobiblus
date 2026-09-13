# Philobiblus

Philobiblus là ứng dụng React/Vite, FastAPI và PostgreSQL để quản lý thư viện
sách cá nhân. Hướng dẫn này tập trung vào môi trường Kubernetes local bằng k3d,
Helm, Cloudflare Quick Tunnel và stack Prometheus/Grafana.

## Kiến trúc triển khai

```text
Browser local ──► Traefik Ingress ──► Frontend Service ──► React/Vite pod
                         │
                         └── /api ──► Backend Service ───► FastAPI pod
                                                        │
                                                        └──► PostgreSQL PVC

Prometheus ──► ServiceMonitor ──► Backend Service:/metrics
Grafana ────► Prometheus
GitHub Pages ──► Cloudflare Quick Tunnel ──► Backend Service  # demo tạm thời
```

| Thành phần | Cách triển khai hiện tại |
|---|---|
| Frontend, backend, PostgreSQL, PVC, Service, Ingress, seed Job | Helm chart `kubernetes/helm/philobiblus` |
| Ingress controller | Traefik mặc định của k3d/k3s |
| Monitoring | `kube-prometheus-stack` và `ServiceMonitor` của Helm chart |
| NGINX | Chỉ có trong Docker Compose tại `nginx/nginx.conf`; chart Helm hiện **không** có NGINX Deployment/Service |

Traefik Ingress thay vai trò route `/` và `/api` trong môi trường Kubernetes.
Không áp dụng riêng các YAML trong `kubernetes/helm/philobiblus/templates/` bằng
`kubectl apply`: Helm render và quản lý các resource này.

## 1. Triển khai Philobiblus lên k3d bằng Helm

### 1.1. Yêu cầu

Máy triển khai cần Docker, k3d, `kubectl` và Helm. Toàn bộ lệnh dưới đây chạy
từ thư mục gốc của dự án `philobiblus`.

### 1.2. Tạo cụm Kubernetes

```bash
k3d cluster create philobiblus \
  --agents 1 \
  --port "80:80@loadbalancer"

kubectl config use-context k3d-philobiblus
kubectl get nodes
```

Kết quả mong đợi: server và agent có trạng thái `Ready`. k3d cài Traefik làm
Ingress controller mặc định.

### 1.3. Build và import image vào k3d

Helm values local dùng hai image tag `local`; cần build và import chúng trước
khi cài chart.

```bash
docker build --tag philobiblus-backend:local ./backend
docker build --tag philobiblus-frontend:local ./frontend

k3d image import --cluster philobiblus \
  philobiblus-backend:local \
  philobiblus-frontend:local
```

### 1.4. Tạo values local và secret

`values.local.yaml` chứa password PostgreSQL, JWT secret và ImgBB API key;
tệp này đã được Git ignore. Sao chép mẫu rồi thay toàn bộ giá trị
`REPLACE_WITH_...` bằng giá trị local thực tế.

```bash
cp kubernetes/helm/philobiblus/values.local.example.yaml \
  kubernetes/helm/philobiblus/values.local.yaml
```

Để truy cập từ GitHub Pages, `backend.allowedOrigins` trong values local phải
gồm origin Pages, không kèm path. Ví dụ:

```yaml
backend:
  allowedOrigins: http://localhost,https://kazunguyen.github.io
```

### 1.5. Render, cài Helm release và kiểm tra workload

```bash
helm lint kubernetes/helm/philobiblus \
  --values kubernetes/helm/philobiblus/values.local.yaml

helm template philobiblus kubernetes/helm/philobiblus \
  --namespace philobiblus \
  --values kubernetes/helm/philobiblus/values.local.yaml \
  > rendered.yaml

helm upgrade --install philobiblus kubernetes/helm/philobiblus \
  --namespace philobiblus \
  --create-namespace \
  --values kubernetes/helm/philobiblus/values.local.yaml \
  --wait \
  --wait-for-jobs \
  --timeout 10m

kubectl get deployment,pod,service,ingress,pvc -n philobiblus
kubectl rollout status deployment/philobiblus-postgres -n philobiblus
kubectl rollout status deployment/philobiblus-backend -n philobiblus
kubectl rollout status deployment/philobiblus-frontend -n philobiblus
helm test philobiblus -n philobiblus
```

Chart triển khai frontend, backend, PostgreSQL + PVC, Service, Traefik Ingress
và seed hook Job. Seed Job chạy sau install/upgrade và migration có tính
idempotent.

```bash
kubectl get jobs -n philobiblus
kubectl logs job/philobiblus-seed -n philobiblus

curl -I -H 'Host: localhost' http://127.0.0.1/
curl -s -H 'Host: localhost' http://127.0.0.1/api/health
```

Nếu cần upgrade nhưng không muốn seed lại dữ liệu mẫu:

```bash
helm upgrade philobiblus kubernetes/helm/philobiblus \
  --namespace philobiblus \
  --values kubernetes/helm/philobiblus/values.local.yaml \
  --set seed.enabled=false
```

## 2. Expose backend qua Cloudflare Quick Tunnel và GitHub Pages

Quick Tunnel phù hợp demo ngắn hạn: URL thay đổi sau mỗi lần chạy và dừng khi
terminal hoặc máy local dừng. Không coi đây là kiến trúc production.

### 2.1. Mở tunnel từ cluster đến Internet

Script kiểm tra Service backend và CORS trước khi tạo pod `cloudflared` tạm
thời. Giữ terminal này mở để tunnel tiếp tục hoạt động.

```bash
PAGES_ORIGIN=https://kazunguyen.github.io bash ./expose-backend.sh
```

Lấy URL `https://<random>.trycloudflare.com` xuất hiện trong log. Backend đã
có prefix `/api`, nên giá trị build-time cho frontend phải là:

```text
https://<random>.trycloudflare.com/api
```

Quick Tunnel hiện chuyển tiếp toàn bộ backend route, gồm cả `/metrics`. Chỉ
dùng trong demo, không chia sẻ URL khi không cần thiết và dừng bằng `Ctrl+C`
khi hoàn tất.

### 2.2. Đặt `VITE_API_URL` cho GitHub Pages

Cài GitHub CLI, đăng nhập một lần, rồi đặt repository variable và kích hoạt
lại workflow Pages:

```bash
gh auth login

gh variable set VITE_API_URL \
  --repo KwangZung/devops-training-NguyenQuangDung \
  --body 'https://<random>.trycloudflare.com/api'

gh workflow run deploy-pages.yaml \
  --repo KwangZung/devops-training-NguyenQuangDung
```

`VITE_API_URL` được GitHub Actions truyền vào lúc build frontend. Không đặt URL
`localhost` cho GitHub Pages vì trình duyệt của người dùng không thể truy cập
cluster local qua `localhost`.

## 3. Observability với Prometheus và Grafana

Backend expose `/metrics` qua ClusterIP Service. Route này không đi qua
Ingress. `ServiceMonitor` của chart chỉ được tạo sau khi Prometheus Operator
CRD đã có trong cluster.

### 3.1. Cài stack và bật ServiceMonitor

Script dưới đây cài/nâng cấp `kube-prometheus-stack`, bật ServiceMonitor cho
release Philobiblus, đợi backend target `UP`, rồi tự đóng port-forward tạm.

```bash
bash ./setup-monitoring.sh
```

Phiên bản thủ công tương đương dùng values không chứa secret:

```bash
helm repo add prometheus-community \
  https://prometheus-community.github.io/helm-charts
helm repo update prometheus-community

helm upgrade --install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --values monitoring/prometheus-values.yaml \
  --wait \
  --timeout 10m

helm upgrade philobiblus kubernetes/helm/philobiblus \
  --namespace philobiblus \
  --values kubernetes/helm/philobiblus/values.local.yaml \
  --set monitoring.serviceMonitor.enabled=true \
  --wait \
  --wait-for-jobs \
  --timeout 10m
```

`monitoring/prometheus-values.yaml` đặt
`serviceMonitorSelectorNilUsesHelmValues: false` để Prometheus local nhận
ServiceMonitor của namespace `philobiblus`.

Kiểm tra target Prometheus bằng port-forward local:

```bash
kubectl port-forward -n monitoring \
  svc/monitoring-kube-prometheus-prometheus 9090:9090
```

Mở `http://127.0.0.1:9090/targets`; target backend phải `UP`.

### 3.2. Truy cập Grafana và import dashboard

Lấy mật khẩu admin trước, sau đó port-forward Grafana trong terminal riêng:

```bash
kubectl get secret -n monitoring monitoring-grafana \
  -o jsonpath='{.data.admin-password}' | base64 --decode
printf '\n'

kubectl port-forward -n monitoring svc/monitoring-grafana 3000:80
```

Mở `http://127.0.0.1:3000` và đăng nhập với username `admin`. Datasource
Prometheus do `kube-prometheus-stack` provision. Nếu datasource chưa đúng,
đặt Access là `Server` và URL là:

```text
http://monitoring-kube-prometheus-prometheus.monitoring.svc.cluster.local:9090
```

Không đặt `http://127.0.0.1:9090` trong datasource Grafana: địa chỉ đó là
loopback của pod Grafana, không phải Prometheus.

`monitoring/grafana-dashboard.json` là Grafana Dashboard JSON v2 và có thể
import trực tiếp. Trong Grafana, chọn **Dashboards → New → Import**, upload
tệp JSON, map datasource `prometheus` tới datasource Prometheus đang có, rồi
chọn **Import**. Grafana hỗ trợ import dashboard JSON từ file hoặc nội dung
paste qua UI. [Tài liệu import dashboard của Grafana](https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/import-dashboards/)
ghi nhận luồng này.

Dashboard có các panel: backend `up`, request rate, lỗi 5xx, p95 latency và
restart pod. Nếu không thấy dữ liệu, kiểm tra lại query sau trong Grafana
Explore:

```promql
up{namespace="philobiblus",service="philobiblus-backend"}
```

## 4. Phụ lục: kiểm tra pod, database và log

### 4.1. Truy cập PostgreSQL trong pod

Lệnh dưới dùng biến môi trường của container PostgreSQL; không cần in password
ra terminal.

```bash
kubectl exec -it -n philobiblus deployment/philobiblus-postgres \
  -- sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Trong `psql`:

```sql
\dt
SELECT id, username, email FROM users;
SELECT id, title, author, status FROM books;
\q
```

### 4.2. Xem log workload

```bash
kubectl logs -n philobiblus deployment/philobiblus-backend --tail=200 -f
kubectl logs -n philobiblus deployment/philobiblus-frontend --tail=200 -f
kubectl logs -n philobiblus deployment/philobiblus-postgres --tail=200 -f
kubectl logs -n philobiblus job/philobiblus-seed --tail=200

kubectl get pods -n philobiblus
kubectl logs -n philobiblus <pod-name> -c <container-name> --previous
```

`--previous` hiển thị log container trước lần restart gần nhất.

### 4.3. Tạo traffic kiểm thử backend

Chỉ chạy load test trên cluster local và khi không có người dùng demo. Không
chạy qua URL Quick Tunnel công khai.

Traffic vừa: 10 worker, mỗi worker 50 request tới health endpoint.

```bash
kubectl run backend-load-light \
  --namespace philobiblus \
  --rm --restart=Never \
  --image=curlimages/curl:8.10.1 \
  --command -- sh -c '
    for worker in $(seq 1 10); do
      (
        for request in $(seq 1 50); do
          curl --fail --silent http://philobiblus-backend:8000/health >/dev/null || true
        done
      ) &
    done
    wait
  '
```

Traffic nặng nhưng có giới hạn: 50 worker, mỗi worker 400 request. Lệnh này
có thể làm tăng latency hoặc error rate tùy tài nguyên máy, nhưng HTTP load
không thể bảo đảm làm backend crash trên mọi môi trường.

```bash
kubectl run backend-load-heavy \
  --namespace philobiblus \
  --rm --restart=Never \
  --image=curlimages/curl:8.10.1 \
  --command -- sh -c '
    for worker in $(seq 1 50); do
      (
        for request in $(seq 1 400); do
          curl --fail --silent http://philobiblus-backend:8000/health >/dev/null || true
        done
      ) &
    done
    wait
  '
```

Để kiểm thử **chắc chắn** Kubernetes tự restart container mà không tác động
PostgreSQL/PVC, dùng controlled failure injection thay vì cố làm cạn tài
nguyên. Lệnh này gây gián đoạn ngắn cho backend một-replica:

```bash
BACKEND_POD="$(kubectl get pod -n philobiblus \
  -l app.kubernetes.io/component=backend \
  -o jsonpath='{.items[0].metadata.name}')"

kubectl exec -n philobiblus "${BACKEND_POD}" -c backend -- kill -TERM 1

kubectl rollout status deployment/philobiblus-backend -n philobiblus --timeout=60s
kubectl get pod -n philobiblus -l app.kubernetes.io/component=backend
```

Grafana sẽ hiển thị restart qua query:

```promql
sum by (pod) (
  kube_pod_container_status_restarts_total{
    namespace="philobiblus",
    container="backend"
  }
)
```
