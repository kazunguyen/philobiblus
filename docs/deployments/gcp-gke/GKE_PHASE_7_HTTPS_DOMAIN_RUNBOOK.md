# Giai đoạn 7 — Domain, HTTPS và cutover Gateway GKE

> **Người thực hiện:** Gemini. Đây là kế hoạch để triển khai có kiểm soát, chưa phải một thay đổi đã apply. Không destroy Cloud Run, GKE, Cloud SQL, DNS zone hoặc Terraform state trong giai đoạn này.
>
> **Mục tiêu:** cung cấp API qua `https://api.<DOMAIN>/api` trước khi đổi `VITE_API_URL` của GitHub Pages. Gateway hiện dùng global external class `gke-l7-global-external-managed`, vì vậy dùng Certificate Manager certificate map; không dùng Ingress, cert-manager trong cluster hay certificate tự ký.

> Khi chưa có custom domain và đang dùng Cloud Run Nginx HTTPS proxy, xem `GKE_HTTPS_PROXY_CORS_RUNBOOK.md`. Proxy là phương án chuyển tiếp; không thay thế domain + Certificate Manager trong tài liệu này.

## 1. Bối cảnh, scope và kiến trúc đích

### Baseline phải xác nhận lại

| Hạng mục | Giá trị hiện có | Nguồn đúng khi chạy |
| --- | --- | --- |
| Project | `grace-enhanced` | `gcloud config get-value project` |
| Region | `asia-southeast1` | Terraform output `cluster_location` |
| Cluster | `philobiblus-dev-gke` | Terraform output `cluster_name` |
| Gateway class | `gke-l7-global-external-managed` | `kubectl get gateway philobiblus -n philobiblus` |
| Static IP Gateway | hiện snapshot là `136.68.162.254` | Terraform output `gateway_ip_address` |
| Frontend origin | `https://kazunguyen.github.io` | deployment GitHub Pages đang hoạt động |

Không hard-code IP snapshot vào Terraform, Helm, frontend hay DNS. Static IP do state `gke-platform` quản lý là nguồn đúng.

```text
GitHub Pages https://kazunguyen.github.io
       | HTTPS + CORS
       v
DNS A api.<DOMAIN> -> GKE Gateway static global IP
       |
       v
GKE global external Gateway :443
  networking.gke.io/certmap: <Certificate Manager map>
       |
       v
HTTPRoute host api.<DOMAIN> -> backend Service :8000
       |
       +-> backend Pod -> recommendation ClusterIP / Cloud SQL
```

Không tạo HTTPRoute, `LoadBalancer` Service, listener hay DNS riêng cho recommendation. Nó chỉ được backend gọi trong cluster.

### Quyết định bắt buộc

1. Chỉ dùng một API FQDN, ví dụ `api.example.com`; không dùng apex domain khi frontend tiếp tục chạy ở GitHub Pages.
2. Certificate là **Certificate Manager global Google-managed certificate có DNS authorization**, nằm trong một `CertificateMap` có `CertificateMapEntry` chính xác hostname API.
3. Gateway dùng annotation `networking.gke.io/certmap: <map-name>` và listener `HTTPS:443`. Không thêm `tls`, `certificateRefs`, `networking.gke.io/pre-shared-certs`, Kubernetes TLS Secret hoặc `ManagedCertificate` CRD trên Gateway đó. Google xác nhận trộn `certmap` với certificate refs là lỗi controller.
4. Giữ listener HTTP:80 chỉ cho `RequestRedirect` sang HTTPS. HTTP backend routing phải biến mất sau cutover.
5. Certificate infrastructure thuộc Terraform state `gke-platform`; Gateway/HTTPRoute thuộc Helm release trong state `gke-app`.
6. Không commit DNS token, key, `.tfvars` thật, PEM/private key, kubeconfig, Terraform `.tfplan` hay state.

Nguồn kỹ thuật chuẩn: [Secure a Gateway](https://cloud.google.com/kubernetes-engine/docs/how-to/secure-gateway), [Deploying Gateways](https://cloud.google.com/kubernetes-engine/docs/how-to/deploying-gateways), [Google-managed certificate với DNS authorization](https://cloud.google.com/certificate-manager/docs/deploy-google-managed-dns-auth). Nếu Google provider/CRD hiện tại khác ví dụ dưới đây, Gemini ưu tiên tài liệu chính thức và phải chạy `terraform validate`.

## 2. Cổng bắt đầu

Gemini chỉ được bắt đầu DNS sau khi người vận hành cung cấp một domain thật, quyền quản lý DNS và chọn hostname. Chuẩn bị local, không commit:

```bash
cd /mnt/d/JUNIOR/SEMESTER2/Thuc-tap/JITS_INNO_Labs/devops-training-NguyenQuangDung/phase-2/track-mlops-security/philobiblus

export PROJECT_ID="grace-enhanced"
export REGION="asia-southeast1"
export NAMESPACE="philobiblus"
export API_HOSTNAME="api.<domain-that-you-control>" # FQDN, không https:// và không /api
export FRONTEND_ORIGIN="https://kazunguyen.github.io"

gcloud config set project "$PROJECT_ID"
gcloud auth application-default print-access-token >/dev/null
terraform -chdir=infrastructure/terraform/gke-platform init \
  -backend-config="bucket=grace-enhanced-tfstate-6515597414"

export GATEWAY_IP="$(terraform -chdir=infrastructure/terraform/gke-platform output -raw gateway_ip_address)"
kubectl get gateway,httproute -n "$NAMESPACE"
curl --fail --silent --show-error "http://${GATEWAY_IP}/health"
gcloud services list --enabled --project="$PROJECT_ID" \
  --filter='config.name=certificatemanager.googleapis.com' --format='value(config.name)'
```

Điều kiện qua cổng: Gateway `Programmed=True`, health trên static IP trả 200, static IP tồn tại trong state, Certificate Manager API enabled. Nếu API chưa có, bổ sung resource `google_project_service` vào module IaC hiện quản lý API; không bật thủ công rồi để state drift.

## 3. Terraform: Certificate Manager

### 3.1 Vị trí và contract biến

Sửa `infrastructure/terraform/gke-platform`, không đặt certificate ở `foundation`, `gke-app`, Helm values hay script. Thêm biến:

```hcl
variable "api_hostname" {
  description = "FQDN public API, for example api.example.com. Empty disables HTTPS resources."
  type        = string
  default     = ""

  validation {
    condition     = var.api_hostname == "" || can(regex("^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$", var.api_hostname))
    error_message = "api_hostname must be empty or a lowercase FQDN with no scheme, port, or path."
  }
}

variable "enable_gateway_https" {
  description = "Create Certificate Manager resources only after a controllable DNS hostname exists."
  type        = bool
  default     = false
}
```

Tất cả certificate resources dùng cùng `for_each`/local condition `enable_gateway_https && api_hostname != ""`; thêm precondition/validation để cấm HTTPS enabled với hostname trống. Resource names deterministic, lowercase, short: `${local.name}-api-dnsauth`, `-api-cert`, `-api-map`, `-api-entry`. Gắn labels `application`, `environment`, `managed-by = "terraform"`.

### 3.2 Resources yêu cầu

Gemini triển khai đúng schema Google provider đang lock trong repo:

```hcl
resource "google_certificate_manager_dns_authorization" "api" {
  # domain = var.api_hostname
  # type = "PER_PROJECT_RECORD"
}

resource "google_certificate_manager_certificate" "api" {
  managed {
    domains            = [var.api_hostname]
    dns_authorizations = [google_certificate_manager_dns_authorization.api[...].id]
  }
}

resource "google_certificate_manager_certificate_map" "api" {}

resource "google_certificate_manager_certificate_map_entry" "api" {
  # map = map name; hostname = var.api_hostname
  # certificates = [certificate id]
}
```

Chỉ cấp một non-wildcard certificate cho API hostname. `PER_PROJECT_RECORD` cho DNS authorization giúp tách quyền/certificate giữa các project. Không tự ghép tên `_acme-challenge`: record output từ Google là canonical.

### 3.3 Outputs và example

Thêm output **không sensitive** chứa:

```hcl
output "api_hostname" { value = var.api_hostname }
output "api_certificate_map_name" { value = google_certificate_manager_certificate_map.api[...].name }
output "api_certificate_name" { value = google_certificate_manager_certificate.api[...].name }
output "api_dns_authorization_record" {
  value = google_certificate_manager_dns_authorization.api[...].dns_resource_record[0]
}
```

Record output phải có nguyên `name`, `type`, `data`. Cập nhật `terraform.tfvars.example` bằng placeholder, `enable_gateway_https = false`; giữ local `terraform.tfvars` bị gitignore.

### 3.4 Plan/apply hạ tầng

Sau review, tạo file local rồi chạy:

```bash
cat > infrastructure/terraform/gke-platform/terraform.tfvars <<'EOF'
project_id           = "grace-enhanced"
region               = "asia-southeast1"
environment          = "dev"
state_bucket_name    = "grace-enhanced-tfstate-6515597414"
protect_cluster      = true
api_hostname         = "api.<domain-that-you-control>"
enable_gateway_https = true
EOF
chmod 600 infrastructure/terraform/gke-platform/terraform.tfvars

terraform -chdir=infrastructure/terraform/gke-platform fmt -recursive
terraform -chdir=infrastructure/terraform/gke-platform validate
terraform -chdir=infrastructure/terraform/gke-platform plan -out=https-platform.tfplan
terraform -chdir=infrastructure/terraform/gke-platform show https-platform.tfplan
terraform -chdir=infrastructure/terraform/gke-platform apply https-platform.tfplan
```

Plan chỉ được thêm DNS authorization, certificate, map và entry. Nếu plan replace/destroy cluster, static IP, Cloud SQL, VPC, secrets hay Helm release thì dừng để điều tra trước apply.

## 4. DNS: authorization CNAME và public A record

Hai record có mục đích khác nhau và đều bắt buộc:

- CNAME xác minh quyền quản lý domain cho Certificate Manager và cho phép gia hạn certificate.
- A record đưa browser tới Gateway static IP.

Lấy dữ liệu sau Terraform apply:

```bash
export DNS_AUTH_JSON="$(terraform -chdir=infrastructure/terraform/gke-platform output -json api_dns_authorization_record)"
export DNS_AUTH_NAME="$(printf '%s' "$DNS_AUTH_JSON" | jq -r '.name')"
export DNS_AUTH_TYPE="$(printf '%s' "$DNS_AUTH_JSON" | jq -r '.type')"
export DNS_AUTH_DATA="$(printf '%s' "$DNS_AUTH_JSON" | jq -r '.data')"
export GATEWAY_IP="$(terraform -chdir=infrastructure/terraform/gke-platform output -raw gateway_ip_address)"
printf 'CNAME %s %s -> %s\nA %s -> %s\n' "$DNS_AUTH_TYPE" "$DNS_AUTH_NAME" "$DNS_AUTH_DATA" "$API_HOSTNAME" "$GATEWAY_IP"
```

### DNS ngoài Google Cloud

Gemini chỉ in record và chờ người vận hành sửa tại registrar/DNS provider:

| Type | Host/name | Target/value | TTL |
| --- | --- | --- | --- |
| `CNAME` | chính xác `DNS_AUTH_NAME` output (provider có thể yêu cầu relative host) | chính xác `DNS_AUTH_DATA` output | 300/TTL thấp nhất |
| `A` | `api` trong zone `<DOMAIN>` hoặc FQDN `api.<DOMAIN>` | `GATEWAY_IP` từ output | 300 trong cutover |

Không tạo CNAME tại `api.<DOMAIN>` vì hostname đó cần A record. Không đưa registrar token vào Terraform state.

### Cloud DNS

Chỉ khi authoritative NS thật sự dùng Cloud DNS managed zone trong project, Gemini mới thêm hai `google_dns_record_set` vào Terraform: CNAME dùng `dns_resource_record[0]` nguyên vẹn, A dùng `"${var.api_hostname}."` và `google_compute_global_address.gateway.address`. Trước đó chạy:

```bash
gcloud dns managed-zones list --project="$PROJECT_ID"
gcloud dns managed-zones describe "$DNS_ZONE" --project="$PROJECT_ID"
dig NS "<DOMAIN>" +short
```

### Kiểm tra DNS public

```bash
dig +short CNAME "$DNS_AUTH_NAME" @1.1.1.1
dig +short A "$API_HOSTNAME" @1.1.1.1
dig +short A "$API_HOSTNAME" @8.8.8.8
```

Chỉ qua khi CNAME khớp `DNS_AUTH_DATA` và A khớp `GATEWAY_IP`. Không recreate certificate để chữa DNS propagation hoặc DNS record sai.

## 5. Chờ certificate active

```bash
export CERTIFICATE_NAME="$(terraform -chdir=infrastructure/terraform/gke-platform output -raw api_certificate_name)"
export CERTIFICATE_MAP_NAME="$(terraform -chdir=infrastructure/terraform/gke-platform output -raw api_certificate_map_name)"

gcloud certificate-manager certificates describe "$CERTIFICATE_NAME" \
  --location=global --project="$PROJECT_ID"
gcloud certificate-manager maps entries list --map="$CERTIFICATE_MAP_NAME" \
  --location=global --project="$PROJECT_ID"
```

Gate trước Helm HTTPS: certificate `managed.state: ACTIVE`, authorization cho API hostname `AUTHORIZED`, map entry `ACTIVE`, DNS public đúng. Provisioning có thể mất nhiều phút; nếu sau vài giờ vẫn pending, kiểm tra CNAME public trước.

## 6. Helm/Gateway và HTTPRoute

### Values contract và Terraform bridge

Mở rộng values chart và `gke-app`:

```yaml
gateway:
  enabled: true
  className: gke-l7-global-external-managed
  addressName: ""
  host: ""
  https:
    enabled: false
    certificateMapName: ""
  httpToHttpsRedirect: false
```

`gke-app` lấy `gateway_host`, `gateway_https_enabled`, `gateway_certificate_map_name` bằng typed variables/remote state platform. Sửa `scripts/gcp-gke/30-app-apply.sh` để render local ignored `terraform.tfvars`, fail fast khi HTTPS enabled thiếu host/map, và update example với placeholders. Certificate map name không phải PEM, secret hay full self-link.

### Gateway template khi HTTPS enabled

Render đúng contract sau, vẫn giữ mode local/k3d cũ khi HTTPS disabled:

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  annotations:
    networking.gke.io/certmap: <certificate-map-name>
spec:
  gatewayClassName: gke-l7-global-external-managed
  addresses:
    - type: NamedAddress
      value: <terraform-managed-static-address-name>
  listeners:
    - name: http
      protocol: HTTP
      port: 80
    - name: https
      protocol: HTTPS
      port: 443
      hostname: api.<DOMAIN>
```

Không render `tls` hay `certificateRefs` khi certmap hiện diện.

Render hai route khi HTTPS enabled:

1. `philobiblus-http-redirect`: `parentRefs.sectionName: http`, `hostnames: [api.<DOMAIN>]`, `RequestRedirect.scheme: https`, không có backendRef.
2. `philobiblus-backend`: `parentRefs.sectionName: https`, hostname chính xác, backend Service đúng port `8000`.

Ưu tiên route `PathPrefix: /api` vì public contract là `/api`. Gemini phải đọc router backend và API client trước khi quyết định rewrite; không được để frontend thành `/api/api`. Health check backend Service không cần public route `/health`; nếu cần smoke path thì thêm route có chủ đích và test nó.

GKE chỉ tự redirect khi Gateway có cả HTTP:80 và HTTPS:443; `RequestRedirect` gắn riêng listener HTTP là cách chuẩn. [GKE Gateway redirects](https://cloud.google.com/kubernetes-engine/docs/how-to/deploying-gateways#http-to-https-redirects).

### Render và apply

```bash
helm lint kubernetes/helm/philobiblus
helm template philobiblus kubernetes/helm/philobiblus \
  --set gateway.enabled=true \
  --set gateway.addressName="<address-name>" \
  --set gateway.host="$API_HOSTNAME" \
  --set gateway.https.enabled=true \
  --set gateway.https.certificateMapName="$CERTIFICATE_MAP_NAME" \
  --set gateway.httpToHttpsRedirect=true > /tmp/philobiblus-gateway.yaml
rg -n "certmap|protocol: HTTPS|port: 443|RequestRedirect|sectionName: (http|https)|certificateRefs|pre-shared-certs" /tmp/philobiblus-gateway.yaml

bash scripts/gcp-gke/30-app-apply.sh
kubectl get gateway,httproute -n "$NAMESPACE"
kubectl describe gateway philobiblus -n "$NAMESPACE"
```

Expected: certmap, HTTPS listener, redirect and parent sections. Forbidden: `certificateRefs` and `pre-shared-certs`. Gateway must be `Programmed=True`; both routes must be `Accepted=True` and `ResolvedRefs=True`. Không `kubectl apply` trực tiếp vào manifest do Helm quản lý.

## 7. Kiểm chứng và cutover GitHub Pages

Kiểm tra từ WSL/Internet, không chỉ trong cluster:

```bash
curl -sS -D - -o /dev/null "http://${API_HOSTNAME}/api"
curl -sS -D - -o /dev/null "https://${API_HOSTNAME}/api"
openssl s_client -connect "${API_HOSTNAME}:443" -servername "$API_HOSTNAME" \
  -verify_return_error </dev/null
curl --resolve "${API_HOSTNAME}:443:${GATEWAY_IP}" \
  --fail --silent --show-error "https://${API_HOSTNAME}/api"
```

HTTP phải redirect sang HTTPS. HTTPS phải TLS verify đúng SNI/domain; một `401/403` từ API protected vẫn chứng minh route nếu response được dự kiến. Kiểm tra OPTIONS với origin GitHub Pages; response phải chỉ cho phép đúng `https://kazunguyen.github.io`, không reflect arbitrary origin hoặc dùng `*` với credential.

Chỉ sau đó đổi GitHub Actions variable:

```text
VITE_API_URL=https://api.<DOMAIN>/api
```

Nếu API client hiện tự append `/api`, dùng `https://api.<DOMAIN>` thay vì đoán. Redeploy Pages, dùng browser DevTools xác nhận HTTPS, không mixed-content/CORS lỗi, rồi test login/refresh, sách, admin, recommendation fallback và upload ảnh.

### 7.1 Phương án triển khai thay thế: Cloud Run HTTPS Proxy qua IaC

Khi người vận hành chưa có custom domain sẵn sàng để tạo bản ghi DNS xác thực cho Google Certificate Manager, toàn bộ luồng HTTPS được kích hoạt qua module IaC `infrastructure/terraform/https-proxy` mà không làm thay đổi trạng thái của cụm GKE:

1. **Cơ chế hoạt động**:
   - Cloud Run service `philobiblus-dev-proxy` chạy container Nginx siêu nhẹ (`asia-southeast1-docker.pkg.dev/grace-enhanced/philobiblus/https-proxy`).
   - Cloud Run tự động cấp URL HTTPS được Google chứng nhận: `https://philobiblus-dev-proxy-qi7zqa4cnq-as.a.run.app`.
   - Nginx nhận request từ GitHub Pages (`https://kazunguyen.github.io`), chuyển tiếp nguyên vẹn method, headers (Origin, Authorization...) tới GKE Gateway IP tĩnh `http://136.68.162.254`.
   - GKE Gateway tiếp tục chuyển tiếp request tới backend Pod trên GKE Autopilot.

2. **Cách chạy và quản lý**:
   - Áp dụng proxy qua script: `bash scripts/gcp-gke/35-proxy-apply.sh`.
   - Output cung cấp:
     - `proxy_url`: `https://philobiblus-dev-proxy-qi7zqa4cnq-as.a.run.app`
     - `api_url`: `https://philobiblus-dev-proxy-qi7zqa4cnq-as.a.run.app/api`
   - Thu hồi proxy khi đã cấu hình xong custom domain: `bash scripts/gcp-gke/36-proxy-destroy.sh`.

3. **Cutover sang GitHub Pages**:
   - Cập nhật biến môi trường / secret `VITE_API_URL` trong GitHub repository settings thành:
     `https://philobiblus-dev-proxy-qi7zqa4cnq-as.a.run.app/api`
   - Kích hoạt redeploy GitHub Pages. Trình duyệt gọi HTTPS hợp lệ và không phát sinh lỗi Mixed Content hay CORS.

## 8. Rollback, troubleshooting và Done

Rollback nhanh chỉ là đổi `VITE_API_URL` về Cloud Run HTTPS URL cũ và redeploy Pages. Giữ Cloud Run và toàn bộ DNS/TLS/GKE resources trong thời gian soak; không destroy database, static IP hay certificate khi incident.

| Symptom | Kiểm tra đầu tiên | Hướng sửa |
| --- | --- | --- |
| Certificate pending | `dig CNAME`, `authorizationAttemptInfo` | sửa đúng CNAME output rồi chờ |
| HTTPS fail dù certificate active | Gateway describe, annotation map, map entry state | xác nhận map global/name và không trộn TLS source |
| Certificate hostname mismatch | SNI, map entry hostname | dùng exact FQDN, không test bằng IP |
| HTTP không redirect | hai listeners, redirect route `sectionName: http` | thêm HTTPS+HTTP và RequestRedirect |
| HTTPS 404 | Route Accepted/ResolvedRefs, hostname/path | khớp host `/api`, attach route HTTPS |
| Browser CORS fail | OPTIONS, backend allowed origins | chỉ cho active Pages origin |

Definition of done:

- [ ] Terraform state `gke-platform` quản lý DNS authorization, managed certificate, map và map entry; apply sau đó `No changes`.
- [ ] CNAME và A record resolve đúng từ 1.1.1.1 và 8.8.8.8; certificate/map entry `ACTIVE`.
- [ ] Helm Gateway có certmap + HTTPS 443, không có TLS config xung đột; HTTP redirect và HTTPS API route đều accepted.
- [ ] `https://api.<DOMAIN>/api` TLS verify và API flow chạy; recommendation không public.
- [ ] GitHub Pages gọi API HTTPS không lỗi mixed-content/CORS; Cloud Run rollback URL được ghi lại và còn hoạt động.
- [ ] Không có thông tin nhạy cảm hoặc local generated files được stage Git.
