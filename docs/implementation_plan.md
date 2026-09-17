# Kế hoạch phát triển Philobiblus và áp dụng kiến thức JITS

> Cập nhật: 14/09/2026.  
> Lịch sử chi tiết tuần 9–12, gồm kế hoạch ngày, commit và bằng chứng cũ, được lưu nguyên vẹn tại [`plan_history.md`](plan_history.md).  
> Báo cáo đánh giá đầy đủ nằm tại [`JITS_KNOWLEDGE_AND_PHILOBIBLUS_GAP_ANALYSIS.md`](JITS_KNOWLEDGE_AND_PHILOBIBLUS_GAP_ANALYSIS.md).

## 1. Nguyên tắc quản lý kế hoạch

- Chỉ đánh dấu **đã xác minh** khi có output test, build, deploy hoặc kiểm tra API/runtime; mã nguồn hay manifest đã viết nhưng chưa chạy được ghi là **đã hiện thực, chưa xác minh**.
- Mỗi thay đổi tách theo chức năng hoặc hạ tầng, dùng Conventional Commits, Pull Request nhỏ và không đưa secret, state Terraform hoặc file values local vào Git.
- Helm sở hữu manifest ứng dụng; Terraform sở hữu platform/hạ tầng và gọi Helm release. Không dùng `null_resource` để chạy `kubectl` hoặc `helm` thay cho IaC.
- Ưu tiên an toàn dữ liệu: backup trước migration, không xoá volume/PVC trong automation mặc định, dùng image tag hoặc digest bất biến khi deploy.

## 2. Tóm tắt tiến độ các tuần trước

| Giai đoạn | Tóm tắt thành quả | Trạng thái tổng quan |
|---|---|---|
| Tuần 9 (20–24/08) | Hoàn thiện nền FastAPI/PostgreSQL/React, JWT + ownership, UI CRUD sách, NGINX reverse proxy, Docker Compose và CI pytest ban đầu. | Hoàn thành nền tảng ứng dụng 3 tầng. |
| Tuần 10 (25–31/08) | Bổ sung public dashboard/profile, review, seed data; chuẩn hoá UI bằng Tailwind CSS và shadcn/ui; khởi tạo manifest Kubernetes. | Chức năng sản phẩm và trải nghiệm UI được mở rộng. |
| Tuần 11 (01–07/09) | Hoàn thiện social graph, tags/rating/visibility, reading history/progress, settings; đóng gói Helm chart, secret tách riêng và seed Job. | Mã nguồn feature và Helm đạt mức khá; cần regression trên runtime thật. |
| Tuần 12 | Bổ sung endpoint `/metrics`, ServiceMonitor tùy chọn và GitHub Pages workflow; hoàn tất kết nối GitHub Pages với backend qua endpoint HTTPS, đồng thời cấu hình CORS allow-list và `VITE_API_URL`. Cài kube-prometheus-stack, ServiceMonitor, Grafana dashboard, HPA backend và PrometheusRule kèm runbook. | Prometheus target `UP`; dashboard, HPA và alerting được xác minh runtime. Backend scale từ 3 lên 6 replica khi stress; Alertmanager nhận restart alert. Còn logging tập trung, SLI/SLO và external notification receiver. |

### Bằng chứng runtime tuần 12

- Lưu ảnh dashboard sau stress test tại `screenshots/dashboard-after-stress-test.png`; HPA backend có cấu hình tối thiểu 3, tối đa 6 replica với ngưỡng CPU 70% và đã tăng từ 3 lên 6 replica trong lần kiểm thử tải.
- Prometheus scrape endpoint `/metrics` của backend qua `ServiceMonitor` ở trạng thái `UP`; Grafana hiển thị healthy targets, request rate, 4xx/5xx, p95 latency, restart, CPU, memory và mức dùng PVC.
- Helm release nạp `PrometheusRule` gồm năm alert. Alert `PhilobiblusBackendRestartsDetected` đã được kích hoạt có kiểm soát và Alertmanager đã nhận alert, xác minh đầy đủ luồng phát hiện–cảnh báo–runbook ở local cluster.

## 3. Kiến trúc hiện tại

```text
Browser / GitHub Pages
        │ HTTPS, CORS
        ▼
Ingress hoặc NGINX ── / ─────► React/Vite frontend
        │
        └── /api ────────────► FastAPI backend ───► PostgreSQL + PVC
                                      │
                                      └───────────► ImgBB upload API
```

Local development dùng Docker Compose; local Kubernetes dùng k3d, raw manifests và Helm chart. Secrets được đưa qua `.env` hoặc Kubernetes Secret ngoài Git; backend yêu cầu `DATABASE_URL`, `SECRET_KEY` và `ALLOWED_ORIGINS` từ environment.

## 4. Ma trận áp dụng kiến thức JITS

| Nhóm kiến thức | Ứng dụng trong Philobiblus | Trạng thái | Khoảng cách cần xử lý |
|---|---|---|---|
| DevOps, 12-factor, documentation | Tách frontend/backend/database; cấu hình bằng environment; README, Helm README, implementation history. | Đã áp dụng một phần | Bổ sung runbook, SLO/SLI, postmortem mẫu và bằng chứng deploy mới nhất. |
| Linux/Bash, process, systemd | Shell command trong image/Compose/Helm và seed script. | Áp dụng cơ bản | `Makefile` và `setup.sh` rỗng; cần target lặp lại được cho test, build, deploy, rollback. |
| Git, PR và Conventional Commits | Lịch sử commit có scope rõ; GitHub Actions CI; `.env` và values local không theo dõi Git. | Đã áp dụng một phần | Thiết lập branch protection, PR template, pre-commit và secret scan. |
| Networking, DNS, HTTP/TLS, reverse proxy | NGINX route `/api`, Docker bridge network, Kubernetes Service/Ingress, CORS allow-list; frontend GitHub Pages gọi backend qua endpoint HTTPS. | Đã áp dụng một phần | Chưa có TLS/cert-manager do dự án tự quản lý, security headers, rate limit và NetworkPolicy. |
| Docker và Docker Compose | Backend multi-stage, non-root user, `.dockerignore`; Compose có PostgreSQL healthcheck, volume, seed service. | Đã áp dụng một phần | Frontend còn development image; thêm production multi-stage/non-root/healthcheck; thêm healthcheck cho backend/frontend/nginx. |
| CI/CD | CI backend chạy pytest; GitHub Pages build/deploy frontend, truyền `VITE_API_URL` qua GitHub Actions variable để kết nối backend HTTPS. | Áp dụng một phần | `cd.yaml` rỗng; thiếu lint/type check, frontend test/build gate, Docker build/push, environment approval và Helm deploy. |
| Terraform/IaC | Có thư mục `infrastructure/terraform/`. | Chưa áp dụng | `main.tf` rỗng; cần quản lý Kubernetes platform trước, rồi mới mở rộng cloud. |
| AWS/cloud và IAM | Chưa có cloud resource trong repository. | Chưa áp dụng | Chưa có VPC/ECR/EKS/RDS, OIDC role, remote state, tagging, CloudWatch hay Well-Architected baseline. |
| Kubernetes | Deployment, Service, Ingress, PVC, Secret, init container, probes, request/limit trong Helm chart; backend có HPA với min 3, max 6 replica và CPU target 70%. | Đã áp dụng một phần | HPA đã được stress test, backend tăng đến 6 replica; chưa có ResourceQuota/LimitRange cấp namespace, StatefulSet cho PostgreSQL, RBAC hay NetworkPolicy. |
| Helm | Chart template hoá PostgreSQL, backend, frontend, Service, Ingress, seed hook Job, Secret tùy chọn và ServiceMonitor tùy chọn. | Đã áp dụng một phần | Duy trì values theo môi trường, kiểm chứng install/upgrade/rollback và không quản lý cùng resource bằng Helm lẫn `kubectl apply`. |
| Observability/SRE | FastAPI instrumentator expose `/metrics`; ServiceMonitor và kube-prometheus-stack scrape backend target `UP`; Grafana dashboard có target, request rate, 4xx/5xx, p95 latency, restart, CPU, memory và PVC; PrometheusRule có năm alert kèm runbook; Alertmanager nhận restart alert. | Đã áp dụng một phần | Bổ sung Loki/collector log, SLI/SLO và error budget; cấu hình external notification receiver cho Alertmanager. |
| Application security | bcrypt, JWT expiry, CORS allow-list, Pydantic/ORM, kiểm tra ownership/visibility, upload giới hạn loại MIME và 10 MB. | Đã áp dụng một phần | Thêm rate limit login/upload, kiểm tra magic bytes ảnh, CSP/security header; xem xét chuyển JWT khỏi `localStorage` khi mô hình auth đủ chín. |
| DevSecOps supply chain và K8s hardening | Backend image chạy non-root; Secret tách khỏi values công khai. | Áp dụng rất cơ bản | Chưa có gitleaks, SAST/SCA/Trivy, SBOM, Cosign, PSA restricted, securityContext, ServiceAccount/RBAC, Gatekeeper, Falco hay STRIDE. |
| MLOps | Chưa có bài toán model trong sản phẩm. | Chưa áp dụng | Chỉ mở rộng DVC/MLflow/KServe/Argo khi có tính năng gợi ý sách với dữ liệu và metric đánh giá rõ ràng. |

## 5. Roadmap đang hoạt động

### Kế hoạch tuần 13 (15–21/09/2026) — Phạm vi được duyệt

**Mục tiêu tuần:** khép lại hai khoảng trống Terraform và MLOps bằng các artifact chạy được trên Kubernetes local, bổ sung baseline DevSecOps có thể kiểm chứng và bắt đầu tổng hợp báo cáo thực tập.

#### Phạm vi triển khai

1. **Terraform local:** cấu hình provider Kubernetes và Helm; tạo namespace demo `philobiblus-iac`, Pod Security Admission, ResourceQuota, LimitRange và NetworkPolicy; triển khai một Helm release Philobiblus mới mà không tác động namespace/PVC hiện hành. Secret tiếp tục được tạo ngoài Terraform và tham chiếu qua `existingSecret` để không xuất hiện trong state.
2. **MLOps recommendation:** xây dựng chức năng gợi ý sách theo nội dung từ các thuộc tính công khai `title`, `author`, `genre` và `tags`; dùng DVC quản lý dataset/pipeline, MLflow theo dõi tham số–metric–model artifact, đồng thời đóng gói model service với endpoint health, recommend và metrics.
3. **Tích hợp và vận hành model:** backend gọi recommendation service, frontend hiển thị tối đa năm sách tương tự; chỉ trả sách `PUBLIC`, loại sách đầu vào và dùng fallback theo thể loại khi model chưa sẵn sàng. Đóng gói Docker, triển khai qua Helm và theo dõi request, error, latency cùng model version bằng Prometheus/Grafana.
4. **DevSecOps baseline:** bổ sung security context và ServiceAccount tối thiểu cho workload; đưa Gitleaks, Semgrep, Trivy, frontend build, Helm validation và Terraform validation vào CI ở phạm vi khả thi.
5. **Báo cáo thực tập:** lập dàn ý báo cáo, cập nhật ma trận kiến thức JITS và lưu output/ảnh minh chứng cho Terraform, DVC, MLflow, model API, Kubernetes, CI và dashboard.

#### Tiến độ theo ngày

| Ngày | Trọng tâm | Kết quả dự kiến |
|---|---|---|
| 15/09 | Terraform platform | Hoàn thiện module, provider, namespace demo, quota/limit và NetworkPolicy; `fmt`, `validate`, `plan` thành công. |
| 16/09 | Data và mô hình | Chuẩn bị dataset công khai, DVC pipeline và content-based model TF-IDF; tạo tập đánh giá có phiên bản. |
| 17/09 | Experiment và serving | Theo dõi experiment bằng MLflow, chọn model theo metric; hoàn thiện recommendation API và test. |
| 18/09 | Kubernetes và observability | Build image, triển khai model service qua Helm, tích hợp backend/frontend và xác minh metrics trên Prometheus/Grafana. |
| 19/09 | DevSecOps và báo cáo | Bổ sung các CI gate ưu tiên, thu thập bằng chứng, cập nhật gap analysis và bắt đầu viết báo cáo thực tập. |

#### Tiêu chí nghiệm thu tuần 13

- `terraform fmt -check -recursive`, `terraform validate`, `terraform plan` và `terraform apply` chạy thành công trên namespace demo; state và secret không được Git theo dõi.
- `dvc repro` tái tạo được pipeline data–train–evaluate; MLflow lưu được tham số, metric và model artifact của ít nhất hai experiment có thể so sánh.
- Recommendation API trả danh sách hợp lệ, không làm lộ sách không công khai, có fallback và có automated test cho luồng chính.
- Model service chạy trên Kubernetes, backend/frontend sử dụng được kết quả và Prometheus scrape target ở trạng thái `UP`.
- CI chạy được các gate đã chọn; workload có security baseline; ảnh/output được tổ chức để sử dụng trực tiếp trong báo cáo.

**Hạng mục mở rộng khi còn thời gian:** SLI/SLO và error budget, external Alertmanager receiver, Loki/collector, Argo Workflow hoặc KServe. Không đưa các hạng mục mở rộng vào điều kiện hoàn thành tối thiểu của tuần 13.

### Giai đoạn A — Chốt độ tin cậy của ứng dụng

1. Đồng bộ dependency backend, chạy pytest toàn bộ; chạy `npm ci` và production build frontend; chạy Docker Compose smoke test với PostgreSQL thật.
2. Xác minh migration, seed Job, ownership/visibility, upload ảnh, reading history, review và social flow trên database thật.
3. Bổ sung `Makefile` và `setup.sh` với các target an toàn: `test`, `frontend-build`, `compose-config`, `compose-up`, `images-build`, `helm-lint`, `helm-template`, `deploy-local`, `rollback`.
4. ✅ Cấu hình HPA backend qua Helm: min 3, max 6, CPU target 70%; backend tăng đến 6 replica khi stress test và dashboard ghi lại bằng chứng tại `screenshots/dashboard-after-stress-test.png`.

**Kết quả cần lưu:** output test/build, kết quả smoke test và hướng dẫn tái hiện.

### Giai đoạn B — Chuẩn hoá delivery

1. Mở rộng CI theo thứ tự: format/lint/type check → backend test → frontend build/test → Docker build → Helm lint/template.
2. Hoàn thiện CD: build và push image backend/frontend với tag immutable `sha-...`; tag `v*` tạo release; staging/production có approval; Helm deploy chỉ nhận image tag/digest đã kiểm chứng.
3. Chuyển frontend sang production image multi-stage (build static → web server), chạy non-root và có healthcheck.

**Kết quả cần lưu:** workflow pass/fail mẫu, image registry, Helm revision và rollback thử nghiệm.

### Giai đoạn C — Ứng dụng Terraform cho platform local

Terraform không thay Helm chart. Terraform quản lý điều kiện platform để chart triển khai ổn định:

```text
infrastructure/terraform/
├── modules/
│   ├── namespace-security/       # namespace, PSA, quota, limit range
│   ├── network-policy/           # deny-all và allow rule cần thiết
│   ├── philobiblus-release/      # helm_release cho chart hiện có
│   └── monitoring/               # helm_release kube-prometheus-stack
└── envs/
    └── local-k3d/                # provider, values không nhạy cảm, outputs
```

1. Khởi tạo provider Kubernetes và Helm dùng kubeconfig k3d; state local bị Git ignore trong giai đoạn single-user.
2. Khai báo namespace demo `philobiblus-iac`, Pod Security Admission `restricted`, ResourceQuota và LimitRange; không dùng namespace/PVC hiện hành để thử nghiệm vòng đời Terraform.
3. Khai báo NetworkPolicy deny-all, sau đó allow DNS, frontend → backend và backend → PostgreSQL.
4. Gọi Helm release Philobiblus mới trong namespace demo, giữ `secrets.existingSecret`; không truyền password/JWT qua Terraform variables vì state có thể lưu giá trị.
5. Tái sử dụng `kube-prometheus-stack` hiện có để quan sát release demo; chỉ đưa monitoring release vào Terraform sau khi có kế hoạch import/migration ownership rõ ràng.
6. Khi chuyển sang team/CI/cloud, migrate state sang S3 encrypted + locking; tách bootstrap state khỏi application/platform state.

**Kết quả cần lưu:** `terraform fmt`, `validate`, plan review, apply/destroy thử nghiệm trên namespace demo; không destroy namespace chứa dữ liệu cần giữ.

### Giai đoạn D — Monitoring và SRE baseline

1. ✅ Cài kube-prometheus-stack trên namespace riêng, bật ServiceMonitor và xác minh backend target `/metrics` ở trạng thái `UP` (13/09/2026).
2. ✅ Hoàn thiện Grafana dashboard: healthy backend targets, request rate, 4xx/5xx, p95 latency, restart, CPU, memory và PVC capacity.
3. ✅ Triển khai năm PrometheusRule cho healthy targets, 5xx ratio, p95 latency, backend restart và PostgreSQL PVC; liên kết runbook. Restart alert được xác minh `firing` và Alertmanager nhận alert.
4. Bổ sung Loki/collector log; xác định SLI availability/latency cùng error budget ban đầu; cấu hình external notification receiver cho Alertmanager.

### Giai đoạn E — Hoàn thiện Security capstone

1. Pre-commit: gitleaks, trailing whitespace, YAML validation. CI: Semgrep, SCA, Trivy, Syft SBOM và policy fail HIGH/CRITICAL.
2. Ký image bằng Cosign keyless qua GitHub OIDC; CD chỉ deploy digest/signature hợp lệ.
3. Áp dụng Kubernetes hardening: `runAsNonRoot`, drop capabilities, `allowPrivilegeEscalation: false`, read-only filesystem khi tương thích, ServiceAccount tối thiểu và RBAC rõ phạm vi.
4. Bổ sung TLS/cert-manager, CSP/HSTS/X-Content-Type-Options, rate limit; thực hiện STRIDE cho Browser → Ingress → application → PostgreSQL/ImgBB.
5. Bổ sung audit log/Falco để phát hiện shell trong container và đưa finding vào quy trình triage.

**Điều kiện demo:** secret bị chặn trước commit; image vulnerable bị CI chặn; manifest privileged/`:latest` bị policy từ chối; Falco phát hiện shell trong container.

### Giai đoạn F — Mở rộng cloud hoặc MLOps khi có nhu cầu thật

- **Cloud:** Terraform provision VPC/subnet, ECR, EKS, IAM GitHub OIDC, RDS, ACM/Ingress, logging/GuardDuty/Security Hub. Chỉ mở khi có budget và quy tắc destroy/tagging rõ ràng.
- **MLOps:** triển khai recommender content-based từ metadata sách công khai; DVC quản lý dataset/pipeline, MLflow theo dõi experiment/model artifact, model service cung cấp inference và Prometheus/Grafana giám sát. KServe/Argo chỉ mở rộng sau khi luồng cốt lõi được kiểm chứng.

## 6. Tiêu chí hoàn thành kế hoạch hiện hành

1. Một máy mới có thể tái hiện test, build, Docker Compose và Helm deployment bằng tài liệu/automation đã commit.
2. CI kiểm tra được chất lượng, test, image và IaC; CD deploy được image bất biến có rollback.
3. Terraform tái tạo được namespace security baseline, policy, Helm release và monitoring stack mà không chứa secret trong state/Git.
4. Prometheus/Grafana cung cấp dữ liệu thật; alert có runbook; deployment có resource, probe, TLS và network boundary.
5. Security capstone có đầy đủ bằng chứng pre-commit, pipeline gate, admission control, runtime detection và STRIDE.
