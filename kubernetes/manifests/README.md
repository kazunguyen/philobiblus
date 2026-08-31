# Philobiblus Kubernetes Deployment

Tài liệu hướng dẫn triển khai ứng dụng Philobiblus lên Kubernetes local bằng k3d, Docker và kubectl.

## 1. Kiến trúc triển khai

Các manifest triển khai ứng dụng trong namespace `philobiblus` gồm:

| Thành phần | Kubernetes resource | Image/Service | Vai trò |
|---|---|---|---|
| PostgreSQL | Deployment, Service, PVC, Secret | `postgres:16-alpine`, `postgres:5432` | Lưu trữ dữ liệu ứng dụng |
| FastAPI backend | Deployment, Service | `philobiblus-backend:local`, `backend:8000` | Cung cấp REST API |
| React frontend | Deployment, Service | `philobiblus-frontend:local`, `frontend:5173` | Cung cấp giao diện web |
| Ingress | Ingress | Traefik | Định tuyến `/api` đến backend và các path còn lại đến frontend |

Trong Kubernetes, Ingress thay thế container Nginx được sử dụng trong Docker Compose.

## 2. Yêu cầu môi trường

Cài đặt và kiểm tra các công cụ sau:

```bash
docker --version
k3d version
kubectl version --client
```

Docker Engine phải đang chạy. Với Windows và WSL, Docker Desktop cần bật WSL integration cho distribution đang sử dụng.

Kiểm tra kết nối Docker:

```bash
docker info
```

## 3. Vị trí thực hiện lệnh

Các lệnh trong tài liệu được thực hiện từ thư mục gốc của project:

```bash
cd phase-2/track-mlops-security/philobiblus
```

Cấu trúc manifest:

```text
kubernetes/manifests/
├── namespace.yaml
├── ingress.yaml
├── backend/
│   ├── deployment.yaml
│   └── service.yaml
├── frontend/
│   ├── deployment.yaml
│   └── service.yaml
└── postgres/
    ├── deployment.yaml
    ├── pvc.yaml
    ├── secret.yaml
    └── service.yaml
```

## 4. Tạo local cluster

Kiểm tra các cluster hiện có:

```bash
k3d cluster list
```

Tạo cluster `philobiblus` với một server, một agent và expose HTTP port 80:

```bash
k3d cluster create philobiblus \
  --servers 1 \
  --agents 1 \
  --port "80:80@loadbalancer" \
  --wait
```

Kiểm tra node:

```bash
k3d node list
kubectl get nodes
```

Tất cả node cần ở trạng thái `Ready`.

Nếu port 80 đang được sử dụng, tạo cluster bằng port 8080:

```bash
k3d cluster create philobiblus \
  --servers 1 \
  --agents 1 \
  --port "8080:80@loadbalancer" \
  --wait
```

Khi sử dụng cấu hình này, truy cập ứng dụng tại `http://localhost:8080`.

## 5. Build Docker images

Build image backend và frontend với đúng tag được khai báo trong Deployment:

```bash
docker build -t philobiblus-backend:local ./backend
docker build -t philobiblus-frontend:local ./frontend
```

Kiểm tra image local:

```bash
docker images | grep philobiblus
```

## 6. Import images vào k3d

Image local trên Docker host không tự động xuất hiện trong node của k3d. Import cả hai image vào cluster:

```bash
k3d image import \
  -c philobiblus \
  philobiblus-backend:local \
  philobiblus-frontend:local
```

Manifest sử dụng `imagePullPolicy: IfNotPresent`, do đó Kubernetes sẽ dùng image local đã import và không cố gắng pull từ registry.

## 7. Chuẩn bị Secret

File `postgres/secret.yaml` cung cấp credential dùng cho môi trường local development. Thay các giá trị placeholder trước khi triển khai:

```yaml
stringData:
  POSTGRES_USER: postgres
  POSTGRES_PASSWORD: CHANGE_ME_LOCAL_ONLY
  POSTGRES_DB: philobiblus_db
  SECRET_KEY: CHANGE_ME_JWT_SECRET_LOCAL_ONLY
```

Không sử dụng các giá trị này cho production và không commit credential thật vào Git. Nếu PostgreSQL đã khởi tạo dữ liệu trên PVC, thay đổi password trong Secret không tự động thay đổi password đã lưu trong database.

## 8. Apply manifest

Apply namespace trước, sau đó triển khai PostgreSQL, backend, frontend và Ingress:

```bash
kubectl apply -f kubernetes/manifests/namespace.yaml
kubectl apply -R -f kubernetes/manifests/postgres
kubectl apply -R -f kubernetes/manifests/backend
kubectl apply -R -f kubernetes/manifests/frontend
kubectl apply -f kubernetes/manifests/ingress.yaml
```

Các manifest sử dụng các resource sau:

- Namespace: `philobiblus`
- Database service: `postgres:5432`
- Backend service: `backend:8000`
- Frontend service: `frontend:5173`
- Ingress host: `localhost`

Backend có init container chờ PostgreSQL sẵn sàng trước khi khởi động application container.

## 9. Kiểm tra deployment

Kiểm tra toàn bộ resource:

```bash
kubectl get all -n philobiblus
kubectl get pvc -n philobiblus
kubectl get ingress -n philobiblus
```

Theo dõi Pod cho đến khi tất cả Pod `Running` và `READY`:

```bash
kubectl get pods -n philobiblus -w
```

Kiểm tra trạng thái rollout:

```bash
kubectl rollout status deployment/postgres -n philobiblus
kubectl rollout status deployment/backend -n philobiblus
kubectl rollout status deployment/frontend -n philobiblus
```

Kiểm tra Ingress:

```bash
kubectl describe ingress philobiblus-ingress -n philobiblus
```

## 10. Truy cập ứng dụng

Với cluster expose port 80:

```text
http://localhost
```

Các endpoint kiểm tra nhanh:

```text
Frontend:   http://localhost
API health: http://localhost/api/health
API docs:   http://localhost/api/docs
```

Ingress định tuyến:

```text
/api/* → backend:8000
/*     → frontend:5173
```

## 11. Kiểm tra log và xử lý lỗi

Xem log backend:

```bash
kubectl logs deployment/backend -n philobiblus
```

Xem log frontend:

```bash
kubectl logs deployment/frontend -n philobiblus
```

Xem log PostgreSQL:

```bash
kubectl logs deployment/postgres -n philobiblus
```

Nếu Pod ở trạng thái `Pending`, `CrashLoopBackOff` hoặc `ImagePullBackOff`, kiểm tra event:

```bash
kubectl get events -n philobiblus --sort-by=.lastTimestamp
kubectl describe pod <pod-name> -n philobiblus
```

Các lỗi thường gặp:

| Lỗi | Nguyên nhân thường gặp | Cách kiểm tra |
|---|---|---|
| `ImagePullBackOff` | Image chưa được import vào k3d hoặc tag không khớp | `k3d image import`, kiểm tra tên image trong Deployment |
| Backend chờ PostgreSQL | PostgreSQL chưa Ready hoặc Secret không khớp | `kubectl logs deployment/postgres`, `kubectl describe pod` |
| PVC `Pending` | StorageClass local chưa sẵn sàng | `kubectl get storageclass`, `kubectl describe pvc -n philobiblus` |
| Ingress không truy cập được | Traefik hoặc port mapping chưa hoạt động | `kubectl get ingressclass`, `k3d cluster list` |
| Frontend gọi API lỗi | Ingress path hoặc `VITE_API_URL` không đúng | Kiểm tra `http://localhost/api/health` và browser Network tab |

## 12. Cập nhật image sau khi sửa code

Sau khi thay đổi backend hoặc frontend, build lại image và import lại:

```bash
docker build -t philobiblus-backend:local ./backend
docker build -t philobiblus-frontend:local ./frontend
k3d image import -c philobiblus philobiblus-backend:local philobiblus-frontend:local
```

Restart Deployment để Pod sử dụng image mới:

```bash
kubectl rollout restart deployment/backend -n philobiblus
kubectl rollout restart deployment/frontend -n philobiblus
kubectl rollout status deployment/backend -n philobiblus
kubectl rollout status deployment/frontend -n philobiblus
```

## 13. Xóa deployment và cluster local

Xóa các resource trong namespace:

```bash
kubectl delete namespace philobiblus
```

Lệnh trên xóa cả PostgreSQL PVC và dữ liệu trong namespace. Chỉ thực hiện khi dữ liệu local không còn cần thiết.

Xóa toàn bộ k3d cluster:

```bash
k3d cluster delete philobiblus
```

## 14. Quy trình triển khai tóm tắt

```bash
k3d cluster create philobiblus --servers 1 --agents 1 --port "80:80@loadbalancer" --wait

docker build -t philobiblus-backend:local ./backend
docker build -t philobiblus-frontend:local ./frontend

k3d image import -c philobiblus philobiblus-backend:local philobiblus-frontend:local

kubectl apply -f kubernetes/manifests/namespace.yaml
kubectl apply -R -f kubernetes/manifests/postgres
kubectl apply -R -f kubernetes/manifests/backend
kubectl apply -R -f kubernetes/manifests/frontend
kubectl apply -f kubernetes/manifests/ingress.yaml

kubectl get pods -n philobiblus
kubectl get services -n philobiblus
kubectl get ingress -n philobiblus
```
