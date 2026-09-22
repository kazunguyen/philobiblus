# Tổng hợp kiến thức JITS và đánh giá mức độ áp dụng vào Philobiblus

> Phạm vi rà soát: chương trình `DevSecOps-Training` (Phase 1, Core block Phase 2, track MLOps/Security), mã nguồn và cấu hình Philobiblus.  
> Cập nhật: 10/09/2026.

## 1. Bản đồ kiến thức cô đọng

### DevOps và cách làm việc

- DevOps là văn hoá hợp tác, tự động hoá, đo lường và chia sẻ; mục tiêu vận hành là giao hàng nhanh nhưng an toàn. Các chỉ số DORA cần theo dõi: deployment frequency, lead time, MTTR và change failure rate.
- 12-factor app: cấu hình tách khỏi mã nguồn; dependency khai báo rõ; build/release/run tách biệt; process stateless; log là event stream; môi trường dev/staging/prod tương đồng.
- Git hygiene là một phần của kỹ thuật: branch theo nhiệm vụ, Conventional Commits, PR nhỏ có mô tả, review, README tái hiện được, không commit secret. Khi bị chặn phải nêu rõ mục tiêu, điều đã thử, log và giả thuyết.
- Vận hành tốt cần runbook, postmortem không đổ lỗi, SLI/SLO/error budget và bằng chứng kiểm thử/deploy thay vì chỉ đánh dấu hoàn thành theo mã nguồn.

### Linux, Git và networking

- Linux: filesystem, permission/user/group, pipe/redirect, `find`/`grep`/`awk`/`sed`, process/signal, systemd, log, disk/memory, SSH/rsync và Bash an toàn (`set -euo pipefail`, quote biến, exit code, trap).
- Git: object model, branch, rebase interactive, cherry-pick, resolve conflict, reflog, stash, bisect, pre-commit; chọn trunk-based/GitHub Flow/GitFlow theo release cadence.
- Networking: OSI/TCP-IP, CIDR/private range/NAT, TCP vs UDP, DNS, socket/port; HTTP request/response, reverse proxy; HTTPS gồm DNS → TCP → TLS → HTTP, certificate chain, SNI/ALPN. TLS phải được kết thúc và quản trị chứng chỉ rõ ràng.

### Container, CI/CD, IaC và cloud

- Docker: image layer/cache, `.dockerignore`, `COPY`/`ADD`, `CMD`/`ENTRYPOINT`, multi-stage build, user không phải root, healthcheck, volume, bridge network và image tag bất biến. Docker Compose phù hợp phát triển và mô phỏng stack nhiều tầng.
- CI kiểm tra mọi thay đổi (lint → test → build → scan); CD phát hành/deploy có kiểm soát. Pipeline-as-code cần cache, secrets/environment, matrix/reusable workflow, release tag và approval. Ưu tiên OIDC/credential ngắn hạn thay cho access key tĩnh.
- Terraform: provider/resource/data source/variable/output/state; `plan` trước `apply`, state không commit, remote backend + lock, module tái sử dụng, workspace/môi trường tách biệt và phát hiện drift.
- AWS: IAM user/group/role/policy và explicit deny; S3 policy/presigned URL; VPC public/private subnet, IGW/NAT/security group; MFA, billing alert và tag tài nguyên. Bậc nâng cao gồm Well-Architected, multi-account, SCP, logging tập trung và FinOps.

### Kubernetes, Helm, observability và DevSecOps

- Kubernetes: Pod/Deployment/Service/Ingress, ConfigMap/Secret, PV/PVC/StorageClass, rollout/rollback, resource request/limit, readiness/liveness; RBAC/ServiceAccount, NetworkPolicy và HPA là baseline vận hành.
- Helm đóng gói manifest, tách values theo môi trường, render/lint trước deploy, upgrade/rollback có kiểm soát.
- Observability gồm log, metric, trace. Prometheus pull metrics; Grafana trực quan hoá; Loki tập trung log; Alertmanager gửi cảnh báo. Thiết lập SLI cho traffic/errors/latency/saturation và cảnh báo phải actionable, tránh cardinality cao.
- DevSecOps shift-left: pre-commit secret scan; CI chạy SAST, SCA, image scan, SBOM và ký image; Kubernetes áp dụng PSA restricted, security context, OPA/Gatekeeper, NetworkPolicy; runtime dùng audit log/Falco. Threat model STRIDE định danh spoofing, tampering, repudiation, information disclosure, denial of service và elevation of privilege.
- MLOps (nền tảng để mở rộng): DVC version dataset, MLflow theo dõi experiment/model registry, KServe/BentoML phục vụ model, Argo Workflows tự động data → train → evaluate → deploy, theo dõi latency/RPS/data drift và canary model.

## 2. Thang đánh giá

| Mức | Ý nghĩa |
|---|---|
| 3/3 | Có mã/cấu hình, đã chạy hoặc có test/deploy hiện hành xác minh được. |
| 2/3 | Hiện thực rõ trong mã/cấu hình; chưa đủ bằng chứng runtime mới nhất hoặc còn thiếu một phần production. |
| 1/3 | Mới có một phần nền tảng hoặc workflow tối thiểu. |
| 0/3 | Chưa có artifact thực thi trong repository. |

## 3. Philobiblus đã áp dụng gì và ở mức nào

| Kiến thức | Bằng chứng trong dự án | Mức | Đánh giá ngắn |
|---|---|---:|---|
| Full-stack 3 tầng và 12-factor config | React/Vite, FastAPI, PostgreSQL; biến môi trường bắt buộc; Compose tách `db`, `backend`, `frontend`, `nginx` | 2 | Kiến trúc phù hợp bài 3-tier. `docker compose config --quiet` đã kiểm tra thành công. |
| Linux/Bash và automation | Command shell trong Docker/Helm; script seed | 1 | Có sử dụng môi trường Linux, nhưng `setup.sh` và `Makefile` đang rỗng nên chưa có entry point tự động hoá/repeatable commands. |
| Git workflow/hygiene | Lịch sử commit dùng Conventional Commits, ví dụ `feat(helm)`, `fix(helm)`, `ci(frontend)` | 2 | Lịch sử commit tốt, `.env` không được Git theo dõi. Chưa có bằng chứng branch protection, PR template hay pre-commit. |
| Networking, reverse proxy | NGINX route `/api/`; Compose bridge network; Kubernetes Service/Ingress | 2 | Có reverse proxy và service discovery. Ingress chưa cấu hình TLS; NGINX chưa có security header/rate limit. |
| Docker image hardening | Backend multi-stage, dependency builder, runtime slim và `USER appuser`; `.dockerignore` | 2 | Backend khá tốt. Frontend Dockerfile là Vite development image một stage, dùng `npm install`, chạy root và chưa phải image production tĩnh. |
| Compose, health và persistent data | PostgreSQL healthcheck, `depends_on: service_healthy`, named volume, db seed | 2 | Nền tảng local tốt. Healthcheck mới có DB; backend/frontend/nginx chưa có healthcheck Compose. |
| API security cơ bản | bcrypt, JWT có expiry, CORS allow-list bắt buộc, ORM/Pydantic, kiểm tra ownership/visibility, upload giới hạn MIME/10 MB | 2 | Có kiểm soát authentication/authorization tốt ở nhiều route và test. Cần rate limit, xác thực magic bytes ảnh, security header; JWT nằm trong `localStorage` nên dễ bị ảnh hưởng nếu có XSS. |
| Automated tests | Bộ pytest cho auth/books/social/settings/upload/metrics; CI gọi pytest | 1 | Test có mặt nhưng chưa xác minh được bản mới nhất ở máy hiện tại: environment thiếu `prometheus-fastapi-instrumentator`. `requirements.txt` đã khai báo package này. |
| CI | `.github/workflows/ci.yaml`: Python 3.11, pip cache, pytest trên push/PR main | 1 | Chỉ test backend. Chưa lint/type check, frontend build/test, Docker build, security scan, cache Buildx hay artifact/image registry. |
| CD và release | GitHub Pages workflow build/deploy frontend | 1 | Static frontend có pipeline Pages. `cd.yaml` rỗng: chưa có build/push image tag SHA, release tag, environment approval hoặc Helm deploy tự động. |
| Terraform/IaC | `infrastructure/terraform/main.tf` | 0 | File hiện rỗng; chưa có provider, module, state backend hay provisioned infrastructure. |
| Cloud/IAM | Không có Terraform/AWS configuration | 0 | Chưa áp dụng IAM role/OIDC, S3/RDS/VPC, Well-Architected hay cloud-security baseline. |
| Kubernetes primitives | Raw manifests có Deployment, Service, Ingress, Secret, PVC; Helm template hoá PostgreSQL/backend/frontend/seed Job | 2 | Bao phủ phần cốt lõi. Chart có values, secret tách riêng, init container, resources, probes và Helm test. |
| Helm lifecycle | Chart có `values.yaml`, values local mẫu, lint/template/install/rollback/hook Job trong README | 2 | Theo `implementation_plan.md`, lint/template và deploy k3d từng được xác minh. Phiên làm việc hiện tại không có Helm CLI nên không tái xác minh. |
| Kubernetes security baseline | Không có `securityContext`, `ServiceAccount`, RBAC, NetworkPolicy, PSA/Gatekeeper | 0 | Đây là khoảng cách lớn nhất so với track Security. PostgreSQL cũng là Deployment thay vì StatefulSet. |
| Observability | FastAPI expose `/metrics`, tránh route label cardinality; test endpoint; Helm `ServiceMonitor` tùy chọn | 1 | Instrumentation ứng dụng tốt nhưng `monitoring/prometheus-values.yaml` và dashboard JSON rỗng; ServiceMonitor mặc định tắt; chưa có Prometheus/Grafana/Loki/Alertmanager/SLO. |
| Supply-chain security | Không có gitleaks/Semgrep/Trivy/SCA/SBOM/cosign | 0 | Chưa có gate DevSecOps trong pre-commit hay CI/CD. |
| Runtime security/threat model | Không có Falco, audit-to-Loki, STRIDE | 0 | Chưa đáp ứng phần runtime và threat modeling của capstone Security. |
| MLOps | Không có DVC, MLflow, KServe hay Argo Workflows | 0 | Chưa áp dụng; hợp lý nếu ưu tiên Security capstone, nhưng không nên coi là hoàn thành track MLOps. |
| Documentation/operability | README, implementation plan, Helm README, test Helm; cấu hình local-secret mẫu | 2 | Tài liệu triển khai tốt. Chưa có runbook độc lập, postmortem mẫu, SLO/alert catalog hay checklist rollback được CI kiểm chứng. |

## 4. Kết luận ngắn

Philobiblus đã vượt mức một bài CRUD: có ứng dụng nhiều người dùng, kiểm soát quyền sở hữu dữ liệu, Compose 3-tier, backend container non-root, Kubernetes/Helm nền tảng và endpoint metrics. Phần áp dụng mạnh nhất là **container hoá, mô hình 3 tầng, Kubernetes/Helm cơ bản và application security**.

Mức hiện tại phù hợp **Core block đang hoàn thiện (khoảng 2/3)**, chưa phải capstone DevSecOps end-to-end. Các hạng mục kéo mức đánh giá xuống là **Terraform rỗng, CD rỗng, monitoring stack rỗng, CI chỉ pytest và toàn bộ supply-chain/Kubernetes/runtime security chưa có**.

## 5. Lộ trình áp dụng tiếp theo, theo thứ tự giá trị

### P0 — Chuyển artifact thành bằng chứng chạy được

1. Đồng bộ dependency bằng `pip install -r backend/requirements.txt`, chạy `PYTHONPATH=. pytest -q`; chạy `npm ci && npm run build`; chạy Compose smoke test với PostgreSQL thật.
2. Thực hiện `helm lint`, `helm template`, install/upgrade vào k3d, kiểm tra rollout, PVC, seed Job và `helm test`; lưu output/screenshot vào tài liệu.
3. Hoàn thiện `Makefile` và `setup.sh` với các target an toàn: bootstrap, test, compose config/up/down, image build, Helm lint/template/deploy/rollback. Không đưa lệnh xoá volume/PVC vào target mặc định.

### P1 — Hoàn thiện delivery và chất lượng container

1. Nâng CI thành: format/lint/type check → backend test → frontend build/test → Docker build → Helm lint/template. Dùng `npm ci`, cache dependency/Buildx và fail pipeline khi bất kỳ gate nào lỗi.
2. Viết CD thực: build/push backend và frontend với tag immutable `sha-...`; tag release `v*`; staging/production environment có approval; Helm deploy dùng image digest/tag cố định. Với k3d local, CD cần self-hosted runner hoặc chỉ triển khai manual có kiểm soát.
3. Chuyển Dockerfile frontend sang multi-stage build static → web server production; chạy non-root, thêm healthcheck. Thêm healthcheck cho backend/frontend/nginx Compose và chỉ chạy production mode khi kiểm thử release.
4. Bắt đầu Terraform từ một scope nhỏ nhưng thật: module local/k3d namespace hoặc cloud sandbox; thêm remote state/lock chỉ khi dùng shared/cloud infrastructure. Không commit `.tfstate`/secret.

### P1 — Secure-by-default cho capstone Security

1. Pre-commit: `gitleaks`, trailing whitespace, YAML validation. CI: Semgrep (SAST), dependency scan/SCA, Trivy image scan, Syft SBOM; fail HIGH/CRITICAL theo policy công khai.
2. Ký image bằng Cosign keyless qua GitHub OIDC và chỉ deploy digest/signature đã được xác minh.
3. Áp dụng Kubernetes baseline: namespace PSA `restricted`; `securityContext` (`runAsNonRoot`, drop `ALL`, `allowPrivilegeEscalation: false`, `readOnlyRootFilesystem` khi tương thích); ServiceAccount riêng và `automountServiceAccountToken: false` nếu app không gọi API Kubernetes; RBAC tối thiểu.
4. Thêm deny-all `NetworkPolicy`, sau đó allow rõ frontend → backend, backend → PostgreSQL và DNS. Bổ sung TLS/cert-manager cho ingress, HTTP security headers/CSP, rate limit cho login/upload, kiểm tra chữ ký thực của ảnh upload.
5. Viết STRIDE một trang cho luồng Browser → Ingress → Frontend/Backend → PostgreSQL/ImgBB, liên kết từng threat với control và test/demo.

### P2 — Đưa vận hành lên mức đo lường được

1. Cài `kube-prometheus-stack`; bật ServiceMonitor sau khi CRD sẵn sàng; xác minh target `/metrics` là `UP` và không public qua Ingress.
2. Điền dashboard với request rate, 4xx/5xx, p95 latency, pod restart, CPU/memory; thêm alert rule có owner/runbook. Cài Loki/Promtail và Alertmanager sau khi metric hoạt động ổn định.
3. Chọn SLO ban đầu, ví dụ availability API và latency p95; ghi error budget và quy tắc rollback. Sau đó mới bổ sung Falco/audit log để hoàn thành runtime security.

### Nhánh MLOps (chỉ thực hiện nếu mở rộng sản phẩm có mô hình ML)

Không thêm MLflow/DVC/KServe chỉ để đủ tên công nghệ. Khi Philobiblus có bài toán gợi ý sách thật, bắt đầu bằng version dataset + experiment tracking, rồi inference FastAPI/KServe, cuối cùng mới tự động hoá train/promote/canary và drift monitoring.

## 6. Điều kiện hoàn thành DevSecOps capstone cho dự án này

Philobiblus có thể được coi là Security capstone khi demo được bốn luồng: (1) secret bị pre-commit chặn; (2) image có lỗ hổng mức policy bị CI chặn và có SBOM/signature; (3) manifest privileged/`:latest` bị admission policy từ chối, workload có NetworkPolicy; (4) shell trong container sinh runtime finding. Kèm theo threat model STRIDE, dashboard/alert có dữ liệu thật, README/runbook và video chứng minh luồng end-to-end.

