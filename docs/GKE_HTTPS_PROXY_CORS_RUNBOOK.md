# Khắc phục CORS khi GitHub Pages gọi Cloud Run HTTPS Nginx Proxy

> Cập nhật: 21/09/2026. Runbook này áp dụng cho phương án tạm thời ở Giai đoạn 7: GitHub Pages gọi Cloud Run Nginx proxy, proxy chuyển tiếp đến GKE Gateway HTTP static IP. Khi có custom domain, chuyển sang Certificate Manager + Gateway HTTPS theo `GKE_PHASE_7_HTTPS_DOMAIN_RUNBOOK.md`.

## Kết luận từ sự cố hiện tại

Lỗi browser báo request tới:

```text
https://philobiblus-dev-backend-qi7zqa4cnq-as.a.run.app/api/auth/me
```

Đây là **Cloud Run backend cũ**, không phải HTTPS proxy đã deploy. Proxy có hostname khác:

```text
https://philobiblus-dev-proxy-qi7zqa4cnq-as.a.run.app/api
```

Kết quả kiểm tra lúc viết tài liệu:

| Request | Kết quả | Ý nghĩa |
| --- | --- | --- |
| `OPTIONS` qua proxy tới `/api/auth/me`, có `Origin: https://kazunguyen.github.io` và `Authorization` preflight | `200 OK`, `Access-Control-Allow-Origin: https://kazunguyen.github.io`, `Access-Control-Allow-Credentials: true`, allow `authorization` | Nginx chuyển tiếp preflight đúng và backend GKE cấu hình CORS đúng. |
| `GET /health` qua proxy | `200 OK` | Cloud Run proxy nối được Gateway GKE. |
| `GET /api/auth/me` qua proxy với Bearer token giả | `401 Unauthorized` kèm CORS header đúng | Route tới backend hoạt động; 401 là response API dự kiến khi token sai. |
| `OPTIONS` tới URL Cloud Run backend cũ trong lỗi | `404 Not Found` | Browser chặn vì preflight không có HTTP 2xx. Đây là nguyên nhân trực tiếp. |

Vì Vite nhúng `VITE_API_URL` vào bundle ở **thời điểm build**, deploy Cloud Run proxy không tự cập nhật GitHub Pages. Bundle đang được Pages phục vụ vẫn mang URL backend cũ, nên browser hoàn toàn không đi qua Nginx proxy.

## 1. Khắc phục ngay

Chạy trong WSL tại root repository. Không đưa URL proxy vào source code; lấy từ Terraform remote state để không nhầm hostname hoặc tự gõ thiếu `/api`.

```bash
cd /mnt/d/JUNIOR/SEMESTER2/Thuc-tap/JITS_INNO_Labs/devops-training-NguyenQuangDung/phase-2/track-mlops-security/philobiblus

terraform -chdir=infrastructure/terraform/https-proxy init \
  -backend-config="bucket=grace-enhanced-tfstate-6515597414"

export PROXY_API_URL="$(terraform -chdir=infrastructure/terraform/https-proxy output -raw api_url)"
printf 'VITE_API_URL=%s\n' "$PROXY_API_URL"
```

Giá trị cần đưa vào GitHub Actions repository variable là chính xác output trên, dạng:

```text
VITE_API_URL=https://philobiblus-dev-proxy-<hash>-as.a.run.app/api
```

Không dùng:

- `https://philobiblus-dev-backend-<hash>-as.a.run.app/api` — runtime Cloud Run cũ, hiện preflight trả 404;
- `http://<GKE_STATIC_IP>/api` — GitHub Pages HTTPS sẽ bị mixed content;
- proxy URL không có `/api` — frontend hiện ghép `/auth`, `/books`, ... sau `VITE_API_URL`.

### Cập nhật variable và redeploy Pages

```bash
gh auth status --hostname github.com

gh variable set VITE_API_URL \
  --repo KwangZung/devops-training-NguyenQuangDung \
  --body "$PROXY_API_URL"

gh workflow run deploy-pages.yaml \
  --repo KwangZung/devops-training-NguyenQuangDung \
  --ref "$(git branch --show-current)"

gh run list \
  --repo KwangZung/devops-training-NguyenQuangDung \
  --workflow deploy-pages.yaml \
  --limit 1
```

Chờ workflow Pages thành công, sau đó hard-refresh trang hoặc mở cửa sổ Incognito. Mở DevTools > Network và xác nhận URL của `GET /api/auth/me` bắt đầu bằng `https://philobiblus-dev-proxy-`, không phải `https://philobiblus-dev-backend-`.

## 2. Kiểm tra bắt buộc trước và sau cutover

Các request này mô phỏng chính xác preflight do `Authorization` header trong `authService.getCurrentUser()` gây ra:

```bash
curl -i -X OPTIONS "$PROXY_API_URL/auth/me" \
  -H 'Origin: https://kazunguyen.github.io' \
  -H 'Access-Control-Request-Method: GET' \
  -H 'Access-Control-Request-Headers: authorization'

curl -i "$PROXY_API_URL/health"

curl -i "$PROXY_API_URL/auth/me" \
  -H 'Origin: https://kazunguyen.github.io' \
  -H 'Authorization: Bearer deliberately-invalid-token'
```

Kết quả yêu cầu:

- OPTIONS: HTTP 200, `Access-Control-Allow-Origin: https://kazunguyen.github.io`, `Access-Control-Allow-Credentials: true`, và `access-control-allow-headers` chứa `authorization`.
- Health: HTTP 200.
- `auth/me` với token sai: HTTP 401 là hợp lệ, nhưng vẫn phải có `Access-Control-Allow-Origin` đúng origin.

Sau Pages deploy, browser phải thực hiện thành công login/refresh, load current user, sách, admin API, recommendation fallback và upload ảnh. Kiểm tra tab Network không có request nào còn gọi hostname `philobiblus-dev-backend-`.

## 3. Giữ Nginx đơn giản: proxy CORS, không tự tạo CORS header

`proxy/default.conf.template` hiện forward toàn bộ method và header đến backend. Đây là cấu hình đúng cho CORS trong kiến trúc này:

```nginx
location / {
    proxy_pass ${BACKEND_UPSTREAM};
    proxy_http_version 1.1;
    proxy_set_header Host $proxy_host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
}
```

FastAPI `CORSMiddleware` là nơi duy nhất quyết định CORS. Backend GKE nhận `ALLOWED_ORIGINS` từ `frontend_origin` của `gke-app`, hiện là `https://kazunguyen.github.io`; vì vậy proxy chỉ cần chuyển tiếp `OPTIONS`, `Origin` và `Access-Control-Request-*` như hiện tại.

Không thêm `add_header Access-Control-Allow-Origin *` hoặc `if ($request_method = OPTIONS)` vào Nginx trong sự cố này. Các cách đó có thể tạo header trùng với FastAPI, mở CORS cho origin không mong muốn, hoặc không tương thích với `allow_credentials=True`.

Nếu Pages origin đổi sang custom domain, update `frontend_origin` trong local `infrastructure/terraform/gke-app/terraform.tfvars`, apply `gke-app`, rồi xác minh OPTIONS với origin mới trước khi đổi Pages. Origin phải chỉ gồm scheme + host, không có path hoặc dấu `/` cuối.

## 4. Ngăn tái diễn: sửa đường cập nhật GitHub Pages

`scripts/configure-github-pages.sh` hiện đọc `infrastructure/terraform/runtime` và luôn ghi URL Cloud Run backend cũ vào `VITE_API_URL`. Script này không được dùng khi frontend phải gọi HTTPS proxy.

Gemini cần thay thế script đó bằng contract explicit, không tự chọn runtime:

```bash
# Usage: bash scripts/configure-github-pages.sh "https://.../api"
API_URL="${1:?Usage: bash scripts/configure-github-pages.sh https://api-host/api}"

case "$API_URL" in
  https://*/api) ;;
  *) echo "API URL must be an HTTPS URL ending in /api" >&2; exit 1 ;;
esac

gh variable set VITE_API_URL --repo "$GITHUB_REPOSITORY" --body "$API_URL"
gh workflow run deploy-pages.yaml --repo "$GITHUB_REPOSITORY" --ref "$FRONTEND_REF"
```

Hoặc tạo script riêng `scripts/k8s-terraform/37-proxy-pages-cutover.sh` để lấy `api_url` từ `https-proxy` Terraform output rồi gọi `gh variable set`. Script phải in final API URL, làm preflight OPTIONS trước khi đổi variable, và không lưu token/GitHub credential trong repository.

Điều chỉnh `scripts/k8s-terraform/35-proxy-apply.sh` để sau apply in một lệnh copy-paste rõ ràng:

```bash
bash scripts/configure-github-pages.sh "$(terraform -chdir=infrastructure/terraform/https-proxy output -raw api_url)"
```

Không đổi frontend source để hard-code URL; `VITE_API_URL` tiếp tục là build-time repository variable.

## 5. Khi lỗi vẫn còn sau khi Pages đã dùng proxy URL

| Dấu hiệu | Kiểm tra | Khắc phục |
| --- | --- | --- |
| Network vẫn gọi `...-backend-...a.run.app` | GitHub variable, workflow run mới nhất, cache browser | set proxy `api_url`, rerun Pages, hard-refresh/Incognito |
| OPTIONS proxy không 200 | curl ở phần 2, Cloud Run proxy logs, Gateway health | kiểm tra proxy upstream và backend/Gateway trước; không che bằng Nginx wildcard CORS |
| OPTIONS 200 nhưng thiếu origin | `ALLOWED_ORIGINS` trong backend Pod và `frontend_origin` của gke-app | set exact Pages origin, apply gke-app, restart/rollout backend nếu cần |
| Chỉ URL `/api` lỗi 404 | API URL/route path | confirm `VITE_API_URL` kết thúc đúng một lần bằng `/api`; tránh `/api/api` |
| Proxy health 502/504 | Cloud Run proxy logs, `http://<gateway-ip>/health`, Gateway status | kiểm tra static IP/upstream Gateway và backend readiness |

## 6. Definition of done

- [ ] GitHub Pages variable lấy từ Terraform `https-proxy` output `api_url`.
- [ ] Pages workflow sau variable update đã thành công; bundle mới không chứa hostname Cloud Run backend cũ.
- [ ] OPTIONS qua proxy trả HTTP 200 và CORS policy chỉ allow active Pages origin.
- [ ] `/health` qua proxy trả 200; API request với token không hợp lệ trả 401 kèm CORS headers.
- [ ] Browser có thể hoàn thành các luồng chính mà không có CORS/mixed-content error.
- [ ] `scripts/configure-github-pages.sh` không còn âm thầm ghi runtime backend URL khi chọn proxy deployment.
