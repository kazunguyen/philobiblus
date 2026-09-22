# GKE Terraform scripts

Run from WSL. These scripts deploy GKE alongside the existing Cloud Run runtime; they do not destroy Cloud Run.

```bash
cd /mnt/d/JUNIOR/SEMESTER2/Thuc-tap/JITS_INNO_Labs/devops-training-NguyenQuangDung/phase-2/track-mlops-security/philobiblus
bash scripts/k8s-terraform/deploy.sh
```

Individual steps:

```bash
bash scripts/k8s-terraform/00-preflight.sh
bash scripts/k8s-terraform/05-install-auth-plugin.sh
bash scripts/k8s-terraform/10-configure.sh
bash scripts/k8s-terraform/15-platform-plan.sh
bash scripts/k8s-terraform/20-platform-apply.sh
bash scripts/k8s-terraform/25-kubeconfig.sh
bash scripts/k8s-terraform/27-core-secrets.sh
bash scripts/k8s-terraform/30-app-apply.sh
bash scripts/k8s-terraform/35-proxy-apply.sh
bash scripts/k8s-terraform/40-verify.sh
bash scripts/k8s-terraform/status.sh
```

Generated `terraform.tfvars`, Terraform plans and `scripts/k8s-terraform/.local/` are ignored. The local kubeconfig contains a short-lived access token; rerun `25-kubeconfig.sh` khi hết hạn.

## Cloud Run HTTPS Proxy (Phase 7 Alternative)

Khi chưa có custom domain đăng ký để gắn Certificate Manager vào GKE Gateway, ta triển khai một Reverse Proxy Nginx siêu nhẹ trên Cloud Run qua module IaC `infrastructure/terraform/https-proxy`. Cloud Run tự động cấp URL HTTPS được Google chứng nhận, nhận traffic từ GitHub Pages và chuyển tiếp tới GKE Gateway IP:

```bash
bash scripts/k8s-terraform/35-proxy-apply.sh
```

Sau khi chạy, script in ra `Frontend API URL` có đuôi `/api` dùng để cập nhật vào `VITE_API_URL` của GitHub Actions. Khi đã có custom domain riêng, ta có thể thu hồi proxy bằng lệnh:

```bash
bash scripts/k8s-terraform/36-proxy-destroy.sh
```
## Running long Terraform operations

Cloud SQL and GKE creation can take longer than an interactive shell session.
Run either long apply script in the background and inspect its log without
interrupting Terraform:

```bash
bash scripts/k8s-terraform/run-background.sh 20-platform-apply.sh
bash scripts/k8s-terraform/follow-background.sh 20-platform-apply
```
