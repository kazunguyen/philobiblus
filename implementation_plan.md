# Đánh giá dự án Philobiblus & Kế hoạch tuần 9

## I. Kết quả kiểm tra so với báo cáo tuần 8

### Backend — Đạt hoàn toàn

| Hạng mục báo cáo | Trạng thái | Chi tiết |
|---|---|---|
| Database schema 2 bảng (users, books) | ✅ Đạt | Thậm chí có thêm `is_active`, `created_at`, `updated_at`, `pages_total`, `pages_read` — hoàn thiện hơn báo cáo |
| Module `database` (SQLAlchemy session) | ✅ Đạt | `create_engine`, `SessionLocal`, `Base`, `get_db()` dependency |
| Module `models` (2 ORM model) | ✅ Đạt | `User`, `Book` + Enum `BookStatus` |
| Module `schemas` (Pydantic) | ✅ Đạt | User, Book, Token schemas đầy đủ với validation |
| Module `auth` (bcrypt + JWT) | ✅ Đạt | `verify_password`, `get_password_hash`, `create_access_token`, `get_current_user` |
| Router `/api/auth/` (register, login, me) | ✅ Đạt | 3 endpoint hoạt động đúng |
| Router `/api/books/` (5 CRUD + JWT) | ✅ Đạt | list (có filter/search/pagination), create, get, update, delete — tất cả yêu cầu JWT và kiểm tra ownership |
| Unit tests | ✅ Bonus | 14 test cases bao gồm cả test user isolation |
| Dockerfile multi-stage + non-root | ✅ Bonus | Best practice DevSecOps |

---

### Kiến trúc & Docker — Đã được sửa

| Hạng mục | Trạng thái | Chi tiết |
|---|---|---|
| Nginx Reverse Proxy | ✅ Đã sửa | `nginx/nginx.conf` đã có cấu hình phân luồng `/api/` → backend:8000, còn lại → frontend:5173 |
| Docker-compose đủ 4 service | ✅ Đã sửa | Đã thêm service `nginx` vào `docker-compose.yaml`, expose port 80 |
| Frontend port | ✅ Đã sửa | Thống nhất port 5173 trong `vite.config.js`, `Dockerfile`, `docker-compose.yaml` |
| VITE_API_URL | ✅ Đã sửa | Đổi sang đường dẫn tương đối `/api` để đi qua Nginx |

---

## II. Những gì đã thực hiện trong tuần 9 (20–24/08)

### Tổng hợp commit tuần 9

| Commit | Mô tả |
|---|---|
| `5047e54` | Kết nối Frontend với Backend |
| `4c6409d` | Thêm Nginx service vào docker compose |
| `7a06a32` | Expose Frontend ra port 5173 |
| `87d2936` | Tạo `AuthContext` và `ProtectedRoute` |
| `5ed8040` | Tạo `bookServices.js` gọi Books API |
| `269e581` | Build Dashboard, BookCard, BookForm |
| `399a48c` | Tạo `BookForm` thêm/sửa sách (Modal) |
| `2357540` | Tạo `BookDetailPage` và route `/books/:id` |
| `67c5356` | Thêm GitHub Actions CI chạy pytest |
| `be2588a` | Fix crash khi database chưa khởi động |
| `d35129a` | Fix CI/CD workflow push sang nhánh `main` của repo philobiblus |
| `a02ba41` | Fix lỗi `login is not defined` trong `AuthModal` |
| `5ae84fb` | Ép chọn genre từ danh sách cố định thay vì điền tự do |
| `a2878f2` | Mở rộng quản lý sách: thêm `volume`, `cover_url`; tạo trang riêng `/books` và `/books/:id/edit` |

---

### So sánh Tuần 8 vs Tuần 9

| Hạng mục | Tuần 8 | Tuần 9 |
|---|---|---|
| Backend API | ✅ Hoàn thiện | Không đổi, bổ sung thêm 2 trường `volume`, `cover_url` vào schema |
| Unit tests | ✅ 14 test cases | Cập nhật test để tương thích với schema mới |
| CI pipeline | ❌ Chưa có | ✅ GitHub Actions tự động chạy pytest khi push |
| CD workflow | ❌ Chưa có | ✅ Workflow mirror code sang repo `philobiblus` đúng nhánh `main` |
| Frontend auth flow | ❌ Chưa hoàn chỉnh | ✅ `AuthContext`, `ProtectedRoute`, login/logout hoàn thiện |
| Quản lý sách (CRUD UI) | ❌ Chưa có | ✅ Đủ giao diện: xem danh sách, thêm, sửa, xóa, xem chi tiết |
| Điều hướng (Routing) | ❌ Chỉ có `/` và `/dashboard` stub | ✅ Hệ thống route đầy đủ: `/`, `/dashboard`, `/books`, `/books/add`, `/books/:id`, `/books/:id/edit` |
| Navbar | ❌ Chưa kết nối AuthContext | ✅ Navbar phân biệt trạng thái login, có điều hướng Dashboard / Books / Logout |
| Dữ liệu sách | Chỉ có các trường cơ bản | ✅ Bổ sung `volume` (tập đang đọc) và `cover_url` (ảnh bìa) |
| Genre | Điền tự do | ✅ Chọn từ danh sách cố định 14 thể loại |
| Nginx + Docker | ❌ Thiếu service nginx | ✅ 4 service: frontend, backend, db, nginx — expose port 80 |

---

### Trạng thái Frontend hiện tại (24/08)

| File | Trạng thái | Chi tiết |
|---|---|---|
| `App.jsx` | ✅ Hoàn chỉnh | Route đầy đủ, AuthProvider bao ngoài |
| `context/AuthContext.jsx` | ✅ Hoàn chỉnh | Quản lý trạng thái login, login/logout/register |
| `components/common/ProtectedRoute.jsx` | ✅ Hoàn chỉnh | Redirect về `/` nếu chưa đăng nhập |
| `components/auth/AuthModal.jsx` | ✅ Hoàn chỉnh | Dùng `login()` từ AuthContext, redirect sau đăng nhập |
| `components/layout/Navbar.jsx` | ✅ Hoàn chỉnh | Phân biệt trạng thái, có nút Dashboard / Books / Logout |
| `services/authService.js` | ✅ Hoàn chỉnh | Gọi API register + login |
| `services/bookServices.js` | ✅ Hoàn chỉnh | Đủ 5 CRUD + Bearer token |
| `pages/HomePage.jsx` | ✅ Hoàn chỉnh | Trang chủ với Navbar + AuthModal |
| `pages/DashboardPage.jsx` | ✅ Hoàn chỉnh | Có Navbar, danh sách sách, redirect sang trang add/edit |
| `pages/BookListPage.jsx` | ✅ Mới thêm | Trang `/books` — danh sách sách riêng biệt |
| `pages/BookDetailPage.jsx` | ✅ Hoàn chỉnh | Xem chi tiết, nút Edit redirect sang trang edit |
| `pages/BookAddPage.jsx` | ✅ Mới thêm | Trang `/books/add` — thêm sách với genre select |
| `pages/BookEditPage.jsx` | ✅ Mới thêm | Trang `/books/:id/edit` — sửa sách riêng biệt |
| `components/books/BookCard.jsx` | ✅ Hoàn chỉnh | Hiển thị ảnh bìa, volume, progress bar, 3 nút View/Edit/Delete |
| `components/books/BookForm.jsx` | ✅ Hoàn chỉnh | Modal sửa nhanh, hỗ trợ volume và cover_url |

---

## III. Kế hoạch tuần 10 (25–31/08)

### Tổng quan

Tuần 10 tập trung vào hai hướng song song:

- Mở rộng tính năng xã hội của Philobiblus (dashboard công khai, đánh giá, bình luận, xem người dùng khác, kết bạn).
- Bắt đầu triển khai ứng dụng lên cụm Kubernetes local (k3d).

---

### Ngày 1–2 (25–26/08) — Tính năng xã hội: Dashboard công khai & User Profile

#### Backend

**Sửa `backend/app/routers/books.py`:**
- Thêm endpoint `GET /api/books/public` — trả về danh sách sách của tất cả người dùng trên hệ thống (không cần đăng nhập hoặc chỉ cần đăng nhập, tuỳ quyết định), có filter theo genre và search theo title/author.

**Thêm `backend/app/routers/users.py`:**
- `GET /api/users/{username}` — xem trang cá nhân của một người dùng bất kỳ, trả về thông tin cơ bản (username, ngày tham gia) và danh sách sách của họ.

**Sửa `backend/app/schemas.py`:**
- Thêm `UserPublicOut` schema chỉ expose các trường an toàn (không có email, hashed_password).

#### Frontend

**Tạo `frontend/src/pages/PublicDashboardPage.jsx`** (route `/dashboard`):
- Hiển thị tất cả sách đang có trên hệ thống dưới dạng grid card, kèm filter genre và ô search.
- Đây là trang dự định cho route `/dashboard` hiện đang được giữ lại.

**Tạo `frontend/src/pages/UserProfilePage.jsx`** (route `/users/:username`):
- Hiển thị thông tin cơ bản của người dùng và danh sách sách của họ (chỉ đọc).

#### Tiến độ thực hiện

| Thời gian | Hạng mục | Trạng thái | Ghi chú |
|---|---|---|---|
| 2026-08-25 16:12 +07:00 | Bổ sung schema public user | Đã thực hiện | Thêm `UserPublicOut` trong `backend/app/schemas.py`, chỉ expose `id`, `username`, `created_at`; không trả về `email` hoặc `hashed_password`. |
| 2026-08-25 16:12 +07:00 | Triển khai public books endpoint | Đã thực hiện, cần rà soát thứ tự route | Thêm `GET /api/books/public` trong `backend/app/routers/books.py`, hỗ trợ `genre`, `search`, `skip`, `limit`. Endpoint cần đặt trước route `/{book_id}` để tránh FastAPI parse `public` thành path parameter. |
| 2026-08-25 16:12 +07:00 | Triển khai public user profile endpoint | Đã thực hiện | Tạo `backend/app/routers/users.py` với `GET /api/users/{username}`, trả về thông tin public user và danh sách sách của user đó. |
| 2026-08-25 16:12 +07:00 | Đăng ký users router | Đã thực hiện | Cập nhật `backend/app/main.py` để include `users.router`. |
| 2026-08-25 16:12 +07:00 | Bổ sung backend tests | Đã thực hiện, chưa xác minh runtime | Thêm test cho public books, filter/search public books, public user profile và user profile không tồn tại. |
| 2026-08-25 16:12 +07:00 | Bổ sung frontend service nền | Đã thực hiện | Thêm `getPublicBooks()` trong `frontend/src/services/bookServices.js` và tạo `frontend/src/services/userServices.js` để gọi user profile API. |
| 2026-08-25 16:12 +07:00 | Kiểm thử tự động | Chưa xác minh | Môi trường shell hiện tại chưa có `pytest`/`python` trong PATH; bundled Python có sẵn nhưng chưa cài module `pytest`. Cần chạy lại trong môi trường backend đã cài dependency. |

---

### Ngày 3 (27/08) — Tính năng xã hội: Đánh giá & Bình luận

#### Backend

**Thêm bảng `reviews` trong `backend/app/models.py`:**
```
reviews (id, book_id FK, user_id FK, rating, comment, created_at)
```

**Thêm `backend/app/routers/reviews.py`:**
- `POST /api/books/{book_id}/reviews` — đăng đánh giá (yêu cầu JWT).
- `GET /api/books/{book_id}/reviews` — lấy danh sách đánh giá của 1 cuốn sách (công khai).
- `DELETE /api/reviews/{review_id}` — xoá đánh giá của chính mình.

**Sửa `backend/app/schemas.py`:**
- Thêm `ReviewCreate`, `ReviewOut` schema.

#### Frontend

**Cập nhật `frontend/src/pages/BookDetailPage.jsx`:**
- Thêm section bình luận/đánh giá phía dưới thông tin sách.
- Hiển thị danh sách reviews, form gửi review (chỉ khi đã đăng nhập).

---

### Ngày 4 (28/08) — Tính năng xã hội: Kết bạn & Theo dõi

#### Backend

**Thêm bảng `friendships` trong `backend/app/models.py`:**
```
friendships (id, requester_id FK, receiver_id FK, status, created_at)
```
*status* có thể là `pending`, `accepted`, `blocked`.

**Thêm `backend/app/routers/friendships.py`:**
- `POST /api/users/{username}/follow` — gửi yêu cầu kết bạn.
- `PUT /api/friendships/{id}/accept` — chấp nhận yêu cầu.
- `DELETE /api/friendships/{id}` — huỷ kết bạn.
- `GET /api/users/me/friends` — xem danh sách bạn bè.

#### Frontend

**Cập nhật `frontend/src/pages/UserProfilePage.jsx`:**
- Thêm nút "Kết bạn" / "Huỷ kết bạn" / "Đang chờ".
- Hiển thị trạng thái quan hệ hiện tại với người dùng đang xem.

---

### Ngày 5 (29/08) — Kubernetes: Viết manifest và thử deploy

#### Mục tiêu
Triển khai toàn bộ stack Philobiblus lên cụm k3d local thông qua kubectl apply.

#### Các file cần tạo trong `kubernetes/manifests/`:

```
kubernetes/manifests/
├── namespace.yaml          # Namespace philobiblus
├── postgres/
│   ├── secret.yaml         # DB credentials
│   ├── pvc.yaml            # PersistentVolumeClaim cho data
│   ├── deployment.yaml
│   └── service.yaml
├── backend/
│   ├── deployment.yaml
│   └── service.yaml
├── frontend/
│   ├── deployment.yaml
│   └── service.yaml
└── ingress.yaml            # Ingress thay thế nginx container
```

#### Các bước thực hiện:
1. Tạo cụm k3d: `k3d cluster create philobiblus --port "80:80@loadbalancer"`.
2. Build image backend và frontend, load vào cụm: `k3d image import ...`.
3. Apply toàn bộ manifest: `kubectl apply -f kubernetes/manifests/`.
4. Kiểm tra pod, service, ingress đều running.
5. Truy cập qua `localhost` và kiểm tra đăng ký, đăng nhập, thêm sách.

---

### Thứ tự ưu tiên (nếu không đủ thời gian)

| Mức độ | Hạng mục |
|---|---|
| Bắt buộc | Dashboard công khai `/dashboard` |
| Bắt buộc | User profile `/users/:username` |
| Bắt buộc | Viết Kubernetes manifests và deploy local |
| Quan trọng | Đánh giá & bình luận sách |
| Có thể trì hoãn | Hệ thống kết bạn |

---

## IV. Còn lại cho các tuần sau

| Folder | Kế hoạch |
|---|---|
| `kubernetes/helm/` | Tuần 11: Đóng gói toàn bộ manifest thành Helm chart |
| `monitoring/` (prometheus, grafana) | Tuần 11: Observability |
| `infrastructure/terraform/` | Tuần 12: Infrastructure as Code |

