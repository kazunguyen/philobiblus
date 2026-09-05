# Helm chart Philobiblus

Chart này chuyển toàn bộ workload Kubernetes của Philobiblus thành Helm templates: PostgreSQL + PVC, backend FastAPI, frontend React, Service và Ingress. Chart không chứa credential thực.

## Chuẩn bị secret local

Sao chép file mẫu thành `values.local.yaml`, thay placeholder bằng secret local, rồi giữ file này ngoài Git:

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
helm lint kubernetes/helm/philobiblus
helm template philobiblus kubernetes/helm/philobiblus --namespace philobiblus > rendered.yaml

helm upgrade --install philobiblus kubernetes/helm/philobiblus \
  --namespace philobiblus --create-namespace \
  --values kubernetes/helm/philobiblus/values.local.yaml

kubectl rollout status deployment/philobiblus-postgres -n philobiblus
kubectl rollout status deployment/philobiblus-backend -n philobiblus
kubectl rollout status deployment/philobiblus-frontend -n philobiblus
helm test philobiblus -n philobiblus
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
