# Helm chart Philobiblus

Chart này chuyển toàn bộ workload Kubernetes của Philobiblus thành Helm templates: PostgreSQL + PVC, backend FastAPI, frontend React, Service, Ingress và seed Job. Chart không chứa credential thực.

## Chuẩn bị secret và network configuration local

Sao chép file mẫu thành `values.local.yaml`, thay placeholder bằng secret và các giá trị host/URL/port của môi trường, rồi giữ file này ngoài Git:

```bash
cp kubernetes/helm/philobiblus/values.local.example.yaml kubernetes/helm/philobiblus/values.local.yaml
```

Hoặc tự tạo secret ngoài chart và giữ `secrets.create: false` mặc định:

```bash
kubectl create secret generic philobiblus-secrets \
  --namespace philobiblus \
  --from-literal=POSTGRES_USER=postgres \
  --from-literal=POSTGRES_PASSWORD='<local-password>' \
  --from-literal=POSTGRES_DB=philobiblus_db \
  --from-literal=SECRET_KEY='<long-random-local-secret>'
```

## Kiểm tra và triển khai

```bash
helm lint kubernetes/helm/philobiblus \
  --values kubernetes/helm/philobiblus/values.local.yaml
helm template philobiblus kubernetes/helm/philobiblus \
  --namespace philobiblus \
  --values kubernetes/helm/philobiblus/values.local.yaml > rendered.yaml

helm upgrade --install philobiblus kubernetes/helm/philobiblus \
  --namespace philobiblus --create-namespace \
  --values kubernetes/helm/philobiblus/values.local.yaml

kubectl rollout status deployment/philobiblus-postgres -n philobiblus
kubectl rollout status deployment/philobiblus-backend -n philobiblus
kubectl rollout status deployment/philobiblus-frontend -n philobiblus
helm test philobiblus -n philobiblus
```

## Seed database

Chart tạo Helm hook Job sau mỗi lần cài đặt và, theo mặc định, sau mỗi lần upgrade. Job chờ PostgreSQL sẵn sàng rồi chạy `python -m scripts.seed_database`; script này thực hiện migration idempotent trước khi tạo hoặc cập nhật dữ liệu mẫu.

Kiểm tra kết quả seed:

```bash
kubectl get jobs -n philobiblus
kubectl logs job/philobiblus-seed -n philobiblus
```

Tắt seed khi cần giữ nguyên dữ liệu trong namespace:

```bash
helm upgrade philobiblus kubernetes/helm/philobiblus \
  --namespace philobiblus \
  --values kubernetes/helm/philobiblus/values.local.yaml \
  --set seed.enabled=false
```

Với k3d, build và import `philobiblus-backend:local` và `philobiblus-frontend:local` trước khi cài chart. Nếu dùng tên release khác `philobiblus`, tên Deployment thay đổi theo release; kiểm tra bằng `kubectl get deployment -n philobiblus`.

Rollback và gỡ cài đặt:

```bash
helm history philobiblus -n philobiblus
helm rollback philobiblus <revision> -n philobiblus
helm uninstall philobiblus -n philobiblus
```

`helm uninstall` không tự xóa PVC để tránh mất dữ liệu database ngoài ý muốn. Xóa PVC một cách chủ động khi dữ liệu local không còn cần giữ lại.

## Prometheus

Backend expose `/metrics` qua Service nội bộ, không đi qua Ingress. Khi cluster đã có Prometheus Operator, bật `monitoring.serviceMonitor.enabled=true` trong values private để chart tạo `ServiceMonitor` scrape endpoint này.
