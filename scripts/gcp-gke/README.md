# GKE Terraform scripts

Run from WSL. These scripts deploy GKE alongside the existing Cloud Run runtime; they do not destroy Cloud Run.

```bash
cd /mnt/d/JUNIOR/SEMESTER2/Thuc-tap/JITS_INNO_Labs/devops-training-NguyenQuangDung/phase-2/track-mlops-security/philobiblus
bash scripts/gcp-gke/deploy.sh
```

Individual steps:

```bash
bash scripts/gcp-gke/00-preflight.sh
bash scripts/gcp-gke/05-install-auth-plugin.sh
bash scripts/gcp-gke/10-configure.sh
bash scripts/gcp-gke/15-platform-plan.sh
bash scripts/gcp-gke/20-platform-apply.sh
bash scripts/gcp-gke/25-kubeconfig.sh
bash scripts/gcp-gke/27-core-secrets.sh
bash scripts/gcp-gke/30-app-apply.sh
bash scripts/gcp-gke/35-proxy-apply.sh
bash scripts/gcp-gke/45-observability-apply.sh
bash scripts/gcp-gke/47-rate-limit-alerts-apply.sh
bash scripts/gcp-gke/40-verify.sh
bash scripts/gcp-gke/46-observability-verify.sh
bash scripts/gcp-gke/status.sh
```

Generated `terraform.tfvars`, Terraform plans and `scripts/gcp-gke/.local/` are ignored. The local kubeconfig contains a short-lived access token; rerun `25-kubeconfig.sh` khi hết hạn.

## Cloud Run HTTPS Proxy (Phase 7 Alternative)

Khi chưa có custom domain đăng ký để gắn Certificate Manager vào GKE Gateway, ta triển khai một Reverse Proxy Nginx siêu nhẹ trên Cloud Run qua module IaC `infrastructure/terraform/https-proxy`. Cloud Run tự động cấp URL HTTPS được Google chứng nhận, nhận traffic từ GitHub Pages và chuyển tiếp tới GKE Gateway IP:

```bash
bash scripts/gcp-gke/35-proxy-apply.sh
```

Sau khi chạy, script in ra `Frontend API URL` có đuôi `/api` dùng để cập nhật vào `VITE_API_URL` của GitHub Actions. Khi đã có custom domain riêng, ta có thể thu hồi proxy bằng lệnh:

```bash
bash scripts/gcp-gke/36-proxy-destroy.sh
```
## Running long Terraform operations

Cloud SQL and GKE creation can take longer than an interactive shell session.
Run either long apply script in the background and inspect its log without
interrupting Terraform:

```bash
bash scripts/gcp-gke/run-background.sh 20-platform-apply.sh
bash scripts/gcp-gke/follow-background.sh 20-platform-apply
```

## Observability and GKE teardown

`45-observability-apply.sh` creates a Cloud Monitoring dashboard, an email
notification channel and PromQL alert policies. It reads `alert_email` from
the ignored runtime Terraform variables, or from the `ALERT_EMAIL` environment
variable when it is set. The chart's `PodMonitoring` resources send backend
and recommendation metrics to Google Managed Service for Prometheus.

The first apply deliberately postpones the two rate-limit alerts because Cloud
Monitoring cannot create a PromQL alert until it has indexed the newly emitted
`rate_limit_operations_total` metric. Run `47-rate-limit-alerts-apply.sh`
after normal traffic has produced that metric. It waits for the descriptor and
then applies only the missing alert policies. Later `45` runs preserve the
successful opt-in.

```bash
bash scripts/gcp-gke/45-observability-apply.sh
bash scripts/gcp-gke/47-rate-limit-alerts-apply.sh
bash scripts/gcp-gke/46-observability-verify.sh
```

`90-gke-destroy.sh` destroys only the GKE deployment stack, in dependency
order: observability, Cloud Run HTTPS proxy, Helm application, then the GKE
platform. It does not destroy the Cloud Run runtime, foundation, bootstrap
state bucket, or Docker images. The script requires the exact confirmation it
prints before it makes any change.

```bash
bash scripts/gcp-gke/90-gke-destroy.sh
```
