# Philobiblus — Kế hoạch Dự án

> Ứng dụng web full-stack theo dõi và quản lý danh sách sách đã đọc, được triển khai trên Kubernetes với đầy đủ CI/CD pipeline và khả năng mở rộng sang các kỹ năng DevSecOps nâng cao.

---

## Tổng quan ứng dụng

Philobiblus (tiếng Latin: *người yêu sách*) là một ứng dụng web cá nhân cho phép lưu trữ và quản lý những cuốn sách đã đọc. Người dùng có thể ghi lại tựa sách, tác giả, thể loại, đánh giá, ngày đọc, và ghi chú cá nhân cho từng cuốn.

### Stack kỹ thuật

| Tầng | Công nghệ |
|------|-----------|
| Frontend | React + Vite |
| Backend | FastAPI (Python) |
| Database | PostgreSQL |
| Reverse Proxy | NGINX |
| Container | Docker + docker-compose |
| CI/CD | GitHub Actions |
| Infrastructure | Terraform + k3d (Kubernetes local) |
| Package manager | Helm |

---

## Kiến trúc hệ thống

```
Internet
    │
    ▼
[NGINX] ─── /         ──► [React Frontend] (port 5173)
    │    └── /api/    ──► [FastAPI Backend] (port 8000)
    │                          │
    │                          ▼
    │                    [PostgreSQL]  (port 5432)
    │
(docker-compose for local dev)
(Kubernetes Ingress for production)
```

---

## Kế hoạch 4 tuần

### Tuần 1 — Xây dựng ứng dụng và Container hóa (W1)

Mục tiêu: có một ứng dụng chạy được ở local bằng docker-compose, tương đương bài Weekly Assignment của Week 1 nhưng với code thực tế.

#### Giai đoạn 1A — Backend (FastAPI + PostgreSQL)
- [ ] Khởi tạo repo, cấu trúc folder, `.gitignore`
- [ ] Thiết kế schema database gồm 2 bảng:
  - `users`: `id`, `username`, `email`, `hashed_password`, `created_at`
  - `books`: `id`, `user_id` (FK → users), `title`, `author`, `genre`, `status` (want_to_read / reading / completed), `rating`, `date_started`, `date_finished`, `notes`, `created_at`
- [ ] Kết nối PostgreSQL qua SQLAlchemy ORM
- [ ] Viết các Auth endpoint:
  - `POST /api/auth/register` — đăng ký tài khoản
  - `POST /api/auth/login` — đăng nhập, trả về JWT token
  - `GET /api/auth/me` — lấy thông tin user hiện tại
- [ ] Viết các Book endpoint (yêu cầu xác thực):
  - `GET /api/books` — lấy danh sách sách của user hiện tại
  - `GET /api/books/{id}` — lấy chi tiết 1 cuốn
  - `POST /api/books` — thêm sách mới
  - `PUT /api/books/{id}` — cập nhật thông tin
  - `DELETE /api/books/{id}` — xóa sách
- [ ] Cài đặt JWT authentication với `python-jose` và bcrypt password hashing
- [ ] Viết Dockerfile multi-stage cho backend
- [ ] Viết `init.sql` khởi tạo database khi container khởi động

#### Giai đoạn 1B — Frontend (React)
- [ ] Khởi tạo project React bằng Vite
- [ ] Viết các trang: danh sách sách, thêm sách, chỉnh sửa, xóa
- [ ] Gọi API Backend bằng `fetch` hoặc `axios`
- [ ] Viết Dockerfile multi-stage cho frontend (build static → NGINX serve)

#### Giai đoạn 1C — Kết nối với docker-compose
- [ ] Viết `docker-compose.yml` gồm 3 service: `nginx`, `backend`, `db`
- [ ] Cấu hình NGINX reverse proxy: `/api/` → backend, `/` → frontend
- [ ] Viết Bash script `setup.sh` tự động hóa việc khởi tạo môi trường
- [ ] Kiểm tra toàn bộ luồng chạy trên local: tạo/xem/sửa/xóa sách

**Kết quả đạt được cuối tuần 1:** ứng dụng 3 tầng chạy hoàn chỉnh tại `http://localhost`, mọi thao tác CRUD hoạt động đúng.

---

### Tuần 2 — CI/CD Pipeline (W2)

Mục tiêu: mỗi lần push code lên GitHub đều tự động build, test và đẩy image lên registry.

#### Giai đoạn 2A — Git workflow
- [ ] Thiết lập nhánh: `main` (production), `develop` (staging), `feature/*`
- [ ] Viết quy ước commit theo Conventional Commits
- [ ] Bảo vệ nhánh `main`: yêu cầu Pull Request, không cho phép force push

#### Giai đoạn 2B — GitHub Actions CI
- [ ] Viết workflow `ci.yaml` chạy khi push lên `develop` hoặc mở PR:
  - Lint Python (ruff/flake8) + type check (mypy)
  - Unit test backend bằng pytest
  - Build Docker image backend + frontend
  - Scan image bằng Trivy, báo lỗi nếu có lỗ hổng CRITICAL
- [ ] Viết workflow `cd.yaml` chạy khi merge vào `main`:
  - Build và đẩy image lên Docker Hub (hoặc GitHub Container Registry)
  - Tag image theo `git sha` và `latest`

#### Giai đoạn 2C — Terraform cơ bản
- [ ] Viết Terraform code provision hạ tầng local (sử dụng provider `null` hoặc `local`)
- [ ] Hoặc dùng Terraform để provision Namespace và ConfigMap trên k3d

**Kết quả đạt được cuối tuần 2:** mỗi lần push code, CI tự động chạy trong vài phút và báo kết quả ngay trên GitHub. Image mới sẵn sàng trên registry sau mỗi lần merge.

---

### Tuần 3 — Triển khai lên Kubernetes (W3)

Mục tiêu: ứng dụng chạy trên k3d Cluster thay vì docker-compose, có thể scale và update không downtime.

#### Giai đoạn 3A — Kubernetes manifests
- [ ] Khởi tạo k3d cluster với local registry tích hợp
- [ ] Viết manifest cho từng thành phần:
  - `Deployment` + `Service` cho backend (2 replica)
  - `Deployment` + `Service` cho frontend
  - `StatefulSet` + `PersistentVolumeClaim` cho PostgreSQL
  - `ConfigMap` cho NGINX config và biến môi trường app
  - `Secret` cho database password
- [ ] Viết `Ingress` trỏ traffic vào đúng service
- [ ] Cấu hình RBAC: ServiceAccount riêng cho backend, chỉ có quyền cần thiết

#### Giai đoạn 3B — Helm chart
- [ ] Đóng gói toàn bộ manifest thành 1 Helm chart `philobiblus`
- [ ] Tham số hóa: số replica, image tag, database password qua `values.yaml`
- [ ] Triển khai lên Cluster bằng `helm install`
- [ ] Thực hành rolling update: đổi image tag mới, quan sát các Pod được thay thế từng cái một

#### Giai đoạn 3C — Tích hợp CD vào Kubernetes
- [ ] Cập nhật `cd.yaml` trong GitHub Actions: sau khi push image, tự động chạy `helm upgrade` để deploy phiên bản mới lên Cluster

**Kết quả đạt được cuối tuần 3:** ứng dụng chạy trên Kubernetes, có thể `kubectl scale` backend lên 5 replica và thực hiện rolling update không gián đoạn dịch vụ.

---

### Tuần 4 — Quan sát và Chuẩn bị mở rộng (W4 + dư địa)

Mục tiêu: hệ thống có thể quan sát, đo lường được, và cơ sở hạ tầng sẵn sàng đón nhận các kỹ năng từ tuần 4 trở đi.

#### Giai đoạn 4A — Monitoring stack
- [ ] Triển khai Prometheus + Grafana bằng Helm (`kube-prometheus-stack`)
- [ ] Expose metrics từ FastAPI (thư viện `prometheus-fastapi-instrumentator`)
- [ ] Tạo Grafana Dashboard: số lượng request/phút, latency P95, tỉ lệ lỗi 5xx
- [ ] Triển khai Loki + Promtail để thu log từ tất cả Pod

#### Giai đoạn 4B — Dọn dẹp và tài liệu hóa
- [ ] Viết `README.md` đầy đủ: kiến trúc, prerequisites, hướng dẫn chạy local và trên k3d
- [ ] Viết `Makefile` với các target: `make dev-up`, `make cluster-up`, `make deploy`, `make teardown`
- [ ] Viết Runbook: cách xử lý khi backend Pod bị CrashLoopBackOff, khi database hết dung lượng

#### Giai đoạn 4C — Dư địa cho tương lai
Cơ sở hạ tầng hiện tại được thiết kế để sẵn sàng tích hợp thêm:
- W4: Trivy scan image trong CI (đã có), thêm Vault để quản lý Secret thay cho Kubernetes Secret
- W5: Tích hợp MLflow để gợi ý sách dựa trên lịch sử đọc (nếu muốn thêm tính năng ML)
- W6: PSA Restricted + OPA Gatekeeper + Kyverno bảo vệ Namespace `philobiblus`
- W7: Argo Workflows tự động hóa việc backup database định kỳ, Threat Modeling STRIDE cho kiến trúc

**Kết quả đạt được cuối tuần 4:** hệ thống hoàn chỉnh, có thể quan sát qua Grafana, có tài liệu đầy đủ và cơ sở hạ tầng sẵn sàng cho việc mở rộng tính năng DevSecOps nâng cao.

---

## Mapping kiến thức

| Kỹ năng | Tuần học | Áp dụng trong dự án |
|---------|----------|---------------------|
| Linux + Bash | W1 | `setup.sh`, các lệnh Docker, debug trong Container |
| Docker multi-stage | W1 | Dockerfile cho backend và frontend |
| docker-compose 3-tier | W1 | Môi trường local development |
| Git workflow + branching | W2 | Nhánh main/develop/feature, PR, conventional commits |
| GitHub Actions CI/CD | W2 | Tự động lint, test, build, push, deploy |
| Terraform | W2 | Provision Namespace, ConfigMap trên k3d |
| Kubernetes cơ bản | W3 | Deployment, Service, Ingress, Secret, PVC |
| RBAC | W3 | ServiceAccount riêng cho backend |
| Helm | W3 | Đóng gói và deploy ứng dụng |
| Prometheus + Grafana + Loki | W4 | Quan sát hệ thống |

---

## Cấu trúc repo

```
philobiblus/
├── .github/
│   └── workflows/
│       ├── ci.yaml
│       └── cd.yaml
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── database.py
│   │   ├── models.py          # User + Book ORM models
│   │   ├── schemas.py         # Pydantic schemas cho User + Book + Token
│   │   ├── auth.py            # JWT tạo/xác thực token, bcrypt hashing
│   │   └── routers/
│   │       ├── auth.py        # /api/auth/*
│   │       └── books.py       # /api/books/*
│   ├── tests/
│   │   ├── test_auth.py
│   │   └── test_books.py
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── pages/
│   │   └── components/
│   ├── Dockerfile
│   └── package.json
├── nginx/
│   └── nginx.conf
├── kubernetes/
│   ├── manifests/           # Raw YAML (tuần 3A)
│   └── helm/
│       └── philobiblus/     # Helm chart (tuần 3B)
├── infrastructure/
│   └── terraform/
│       └── main.tf
├── monitoring/
│   ├── prometheus-values.yaml
│   └── grafana-dashboard.json
├── docker-compose.yml
├── Makefile
├── setup.sh
└── README.md
```
