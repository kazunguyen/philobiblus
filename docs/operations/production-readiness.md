# Kế hoạch triển khai P0/P1 về production readiness

## Mục tiêu

Kế hoạch này tập trung vào năm luồng: security gate, quan sát log/trace/SLO, orchestration MLOps, admission policy và phục hồi sự cố. Các cấu hình mặc định được giữ ở chế độ không gây gián đoạn; chỉ chuyển sang enforcement hoặc schedule sau khi kiểm chứng trên GKE.

## P0: Chuỗi cung ứng và observability

| Hạng mục | Nội dung đã bổ sung | Điều kiện nghiệm thu |
|---|---|---|
| Secret scanning | Gitleaks trong workflow `Security gates` | Push/PR chứa secret bị chặn. |
| SAST, SCA, container/IaC scan | Semgrep, pip-audit, npm audit và Trivy | Không còn finding HIGH/CRITICAL được chấp nhận mà chưa có ngoại lệ có thời hạn. |
| SBOM và provenance | SBOM SPDX cho backend, trainer, recommendation; CD ký ba image MLOps bằng Cosign OIDC | Kiểm tra `cosign verify` bằng GitHub OIDC issuer trước deploy. |
| Log có tương quan | Backend trả và ghi `X-Request-ID` ở JSON log | Cloud Logging truy vấn được một request theo `request_id`. |
| Trace và SLO | OTLP collector tùy chọn, recording rule lỗi 5xx, alert burn rate 99.5% | Trace của API xuất hiện tại backend trace store; alert được gửi tới receiver ngoài cluster. |

Kích hoạt trace trên GKE bằng `monitoring.tracing.enabled=true`, `backend.observability.tracing.enabled=true`, endpoint `philobiblus-otel-collector:4317`, exporter `googlecloud`, và ServiceAccount có quyền Cloud Trace Agent. Log JSON đi stdout nên GKE Cloud Logging thu thập mà không cần một Loki thứ hai.

## P1: MLOps, policy và DR

| Hạng mục | Nội dung đã bổ sung | Điều kiện nghiệm thu |
|---|---|---|
| Argo retraining | WorkflowTemplate và CronWorkflow suspended | Một workflow chạy end-to-end, có MLflow gate; chỉ một scheduler được bật. |
| Canary model | Thiết kế tách candidate/stable release được ghi rõ | Candidate có ConfigMap riêng, 10% traffic, metric đánh giá và rollback tự động trước khi promote. |
| Admission policy | Kyverno baseline ở Audit | `PolicyReport` sạch trước khi chuyển Enforce. |
| DR | Runbook RPO/RTO, backup và restore drill | Khôi phục thành công vào namespace/instance cô lập trong RTO. |

Thứ tự kích hoạt: merge security gate, giải quyết finding; kiểm tra JSON log; bật trace ở môi trường dev; cài Argo/Kyverno; chạy workflow thủ công; thực hiện restore drill; cuối cùng chuyển policy sang Enforce. Không kích hoạt đồng thời CronJob Helm và CronWorkflow Argo.
