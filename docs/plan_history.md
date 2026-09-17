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
- Chuẩn hóa giao diện frontend bằng Tailwind CSS và shadcn/ui trước khi tiếp tục mở rộng tính năng xã hội.
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
| 2026-08-25 16:12 +07:00 | Triển khai public books endpoint | Đã thực hiện | Thêm `GET /api/books/public` trong `backend/app/routers/books.py`, hỗ trợ `genre`, `search`, `skip`, `limit`. |
| 2026-08-25 16:12 +07:00 | Triển khai public user profile endpoint | Đã thực hiện | Tạo `backend/app/routers/users.py` với `GET /api/users/{username}`, trả về thông tin public user và danh sách sách của user đó. |
| 2026-08-25 16:12 +07:00 | Đăng ký users router | Đã thực hiện | Cập nhật `backend/app/main.py` để include `users.router`. |
| 2026-08-25 16:12 +07:00 | Bổ sung backend tests | Đã thực hiện, chưa xác minh runtime | Thêm test cho public books, filter/search public books, public user profile và user profile không tồn tại. |
| 2026-08-25 16:12 +07:00 | Bổ sung frontend service nền | Đã thực hiện | Thêm `getPublicBooks()` trong `frontend/src/services/bookServices.js` và tạo `frontend/src/services/userServices.js` để gọi user profile API. |
| 2026-08-25 16:12 +07:00 | Kiểm thử tự động | Chưa xác minh | Môi trường shell hiện tại chưa có `pytest`/`python` trong PATH; bundled Python có sẵn nhưng chưa cài module `pytest`. Cần chạy lại trong môi trường backend đã cài dependency. |
| 2026-08-25 21:46 +07:00 | Hoàn thiện thứ tự route public books | Đã thực hiện | Đặt `GET /api/books/public` trước route `/{book_id}` để tránh xung đột path parameter. |
| 2026-08-25 21:46 +07:00 | Bổ sung public book response có owner | Đã thực hiện | Thêm `BookPublicOut` để public dashboard có dữ liệu owner public phục vụ liên kết sang user profile. |
| 2026-08-25 21:46 +07:00 | Hoàn thiện frontend public dashboard | Đã thực hiện | Tạo `PublicDashboardPage.jsx`, gọi `getPublicBooks()`, hỗ trợ search/filter và hiển thị sách ở chế độ chỉ đọc. |
| 2026-08-25 21:46 +07:00 | Hoàn thiện frontend user profile | Đã thực hiện | Tạo `UserProfilePage.jsx`, gọi `getUserProfile(username)` và hiển thị thông tin user cùng danh sách sách public. |
| 2026-08-25 21:46 +07:00 | Cập nhật điều hướng frontend | Đã thực hiện | Route `/dashboard` chuyển sang public dashboard; route `/users/:username` được bổ sung; các route quản lý sách vẫn yêu cầu `ProtectedRoute`. |
| 2026-08-25 21:46 +07:00 | Kiểm thử build frontend | Đã xác minh | Chạy `npm run build` trong `frontend`, Vite build thành công với 49 modules transformed. |
| 2026-08-25 22:12 +07:00 | Điều chỉnh hướng frontend | Đã quyết định | Chuyển kế hoạch ngày tiếp theo sang chuẩn hóa UI bằng Tailwind CSS và shadcn/ui để giảm inline style và cải thiện tính nhất quán giao diện trước khi phát triển review/comment. |

---

### Ngày 3 (27/08) — Chuẩn hóa Frontend UI bằng Tailwind CSS & shadcn/ui

#### Mục tiêu

Thiết lập design system nền cho frontend, thay thế dần inline style bằng Tailwind CSS và shadcn/ui. Việc này giúp các màn hình social mới có giao diện nhất quán, dễ mở rộng và dễ bảo trì hơn.

#### Setup nền

**Cài đặt Tailwind CSS và shadcn/ui cho `frontend`:**
- Cài dependencies cần thiết cho Tailwind CSS, PostCSS, shadcn/ui utilities và icons.
- Tạo `tailwind.config.js`, `postcss.config.js`, `components.json`.
- Tạo `src/index.css` chứa Tailwind layers và CSS variables theo shadcn/ui.
- Cập nhật `src/main.jsx` để import stylesheet global.
- Cấu hình alias `@/` trong `vite.config.js`.

**Thêm shadcn/ui components ban đầu:**
- `button`
- `card`
- `input`
- `select`
- `textarea`
- `dialog`
- `badge`
- `progress`
- `label`

#### Refactor giao diện ưu tiên

**Sửa `frontend/src/components/layout/Navbar.jsx`:**
- Chuyển từ inline style sang Tailwind CSS.
- Dùng shadcn `Button`.
- Giữ logic auth hiện tại.

**Sửa `frontend/src/components/books/BookCard.jsx`:**
- Chuyển card sang shadcn `Card`.
- Dùng `Badge` cho status/genre.
- Dùng `Progress` cho tiến độ đọc.
- Giữ hỗ trợ `isReadOnly` cho public dashboard/profile.

**Sửa `frontend/src/pages/PublicDashboardPage.jsx`:**
- Dùng shadcn `Input`, `Button`, `Card`.
- Làm filter/search rõ ràng hơn.
- Giữ API call `bookService.getPublicBooks()`.

**Sửa `frontend/src/pages/UserProfilePage.jsx`:**
- Dùng card/header layout nhất quán.
- Hiển thị danh sách sách public bằng `BookCard` đã refactor.

#### Kiểm thử

- Chạy `npm run build`.
- Kiểm tra thủ công `/dashboard`, `/users/:username`, `/books`.
- Đảm bảo không làm hỏng route protected hiện có.

#### Tiến độ thực hiện

| Thời gian | Hạng mục | Trạng thái | Ghi chú |
|---|---|---|---|
| 2026-08-25 22:12 +07:00 | Cấu hình Tailwind CSS v4 | Đã thực hiện | Bổ sung `@tailwindcss/vite`, cấu hình plugin Tailwind trong `vite.config.js`, thêm alias `@` trỏ tới `src`. |
| 2026-08-25 22:12 +07:00 | Bổ sung stylesheet global | Đã thực hiện | Tạo `frontend/src/index.css` với `@import "tailwindcss"` và `@import "tw-animate-css"`, đồng thời cấu hình base style cho body và form controls. |
| 2026-08-25 22:12 +07:00 | Kết nối stylesheet vào React entry | Đã thực hiện | Cập nhật `frontend/src/main.jsx` để import `./index.css`. |
| 2026-08-25 22:12 +07:00 | Loại build output khỏi Git | Đã thực hiện | Cập nhật `.gitignore` để ignore `dist/` sinh ra từ `npm run build`. |
| 2026-08-25 22:12 +07:00 | Kiểm thử build frontend | Đã xác minh | Chạy `npm run build` thành công; Vite build tạo CSS bundle từ Tailwind. |
| 2026-08-26 03:29 +07:00 | Khởi tạo shadcn/ui | Đã thực hiện | Tạo `components.json`, cấu hình alias JS, thêm `src/lib/utils.js` và các component nền trong `src/components/ui`. |
| 2026-08-26 03:29 +07:00 | Bổ sung shadcn components nền | Đã thực hiện | Thêm `button`, `card`, `input`, `select`, `textarea`, `dialog`, `badge`, `progress`, `label`. |
| 2026-08-26 02:28 +07:00 | Chuyển auth popup sang auth pages | Đã thực hiện | Tạo `LoginPage.jsx` và `RegisterPage.jsx` sử dụng shadcn `Card`, `Input`, `Label`, `Button`; thêm route `/login`, `/register`; cập nhật Navbar và HomePage để dùng điều hướng trang thay cho popup. |
| 2026-08-26 02:28 +07:00 | Gỡ auth modal cũ | Đã thực hiện | Xóa `AuthModal.jsx` sau khi xác nhận không còn import nào sử dụng component popup. |
| 2026-08-26 02:28 +07:00 | Kiểm thử build frontend sau auth refactor | Đã xác minh | Chạy `npm run build` thành công sau khi chuyển login/register sang trang riêng. |
| 2026-08-26 03:29 +07:00 | Refactor BookCard bằng shadcn/ui | Đã thực hiện | Chuyển `BookCard.jsx` sang shadcn `Card`, `Badge`, `Progress`, `Button`; luôn hiển thị khung ảnh bìa cố định để card đồng đều khi sách không có ảnh. |
| 2026-08-31 20:39 +07:00 | Refactor BookAddPage và BookEditPage | Đã thực hiện | Chuyển form thêm/sửa sách từ inline style và native controls sang shadcn `Card`, `Input`, `Label`, `Select`, `Textarea`, `Button`; giữ nguyên logic API và điều hướng. Commit `1a2a470`. |
| 2026-08-31 20:48 +07:00 | Refactor BookDetailPage | Đã thực hiện | Chuyển trang chi tiết sách sang shadcn `Card`, `Badge`, `Progress`, `Button`; loại bỏ inline style. Commit `94de875`. |
| 2026-08-31 20:53 +07:00 | Refactor BookForm modal | Đã thực hiện | Chuyển modal thủ công sang shadcn `Dialog`, bổ sung các trường `volume` và `cover_url`, giữ nguyên luồng create/update. Commit `0b8a9f4`. |
| 2026-08-31 21:02 +07:00 | Hoàn thiện refactor UserProfilePage và DashboardPage | Đã thực hiện | Loại bỏ inline style còn sót lại và thống nhất layout với Tailwind/shadcn. Commit `fdd38e5`, `ae28aea`. |
| 2026-08-31 21:10 +07:00 | Kiểm thử build sau khi hoàn tất UI refactor | Đã xác minh | `npm run build` thành công với 2075 modules transformed; working tree sạch sau khi commit các thay đổi. |

---

### Bổ sung — Dữ liệu mẫu local development

#### Mục tiêu

Tạo dữ liệu mẫu phục vụ kiểm tra giao diện public dashboard, user profile, login flow và book card mà không cần nhập thủ công qua UI.

#### Tiến độ thực hiện

| Thời gian | Hạng mục | Trạng thái | Ghi chú |
|---|---|---|---|
| 2026-08-26 03:29 +07:00 | Tạo seed script | Đã thực hiện | Tạo `backend/scripts/seed_database.py`, khởi tạo 3 user `admin`, `user1`, `user2` với email `<username>@gmail.com`, password `admin1111`, và 15 sách mẫu có đầy đủ trường theo model `Book`. |
| 2026-08-26 03:29 +07:00 | Tích hợp seed vào Docker Compose | Đã thực hiện | Thêm service `db-seed`, copy `backend/scripts` vào image backend, chạy seed bằng `python -m scripts.seed_database` với `PYTHONPATH=/app`. |
| 2026-08-26 03:29 +07:00 | Kiểm thử cấu hình Compose | Đã xác minh một phần | Chạy `docker compose config` thành công. Cần chạy lại `docker compose up --build` hoặc `docker compose run --rm db-seed` và kiểm tra số lượng users/books trong PostgreSQL để xác minh dữ liệu đã được insert. |

---

### Ngày 4 (28/08) — Tính năng xã hội: Đánh giá & Bình luận

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

#### Tiến độ cập nhật

| Thời gian | Hạng mục | Trạng thái | Ghi chú |
|---|---|---|---|
| 2026-08-31 22:48 +07:00 | Tích hợp review frontend | Đã thực hiện | Thêm `reviewServices.js`, hiển thị danh sách review và form tạo review trong `BookDetailPage.jsx`. Commit `f82f1ae`. |
| 2026-08-31 22:48 +07:00 | Xóa review của người dùng hiện tại | Đã thực hiện | Bổ sung lấy current user, chỉ hiển thị nút xóa cho review chính chủ; backend tiếp tục kiểm tra ownership. Commit `f82f1ae`. |
| 2026-08-31 22:48 +07:00 | Kiểm thử review runtime | Chưa xác minh | Cần chạy `PYTHONPATH=. pytest -q` trong thư mục `backend`. |

#### Tiến độ thực hiện

| Thời gian | Hạng mục | Trạng thái | Ghi chú |
|---|---|---|---|
| 2026-08-31 21:23 +07:00 | Triển khai Review model, schema và router | Đã thực hiện, chưa xác minh runtime | Bổ sung bảng `reviews`, ba endpoint tạo/lấy/xóa review, đăng ký router trong `main.py`. Commit `59123a6`. |
| 2026-08-31 21:23 +07:00 | Bổ sung backend review tests | Đã thực hiện, chưa xác minh runtime | Thêm 4 test cho tạo review, lấy review công khai, validation rating và quyền xóa theo owner. |
| 2026-08-31 21:23 +07:00 | Tích hợp review vào frontend | Chưa thực hiện | Chưa có `frontend/src/services/reviewServices.js`; `BookDetailPage.jsx` chưa hiển thị danh sách hoặc form review. |

---

### Có thể trì hoãn — Tính năng xã hội: Kết bạn & Theo dõi

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

#### Tiến độ cập nhật

| Thời gian | Hạng mục | Trạng thái | Ghi chú |
|---|---|---|---|
| 2026-08-31 23:15 +07:00 | Viết Kubernetes manifests | Đã thực hiện | Bổ sung namespace, PostgreSQL Deployment/Service/PVC/Secret, backend Deployment/Service, frontend Deployment/Service và Ingress. Commit `d901171`. |
| 2026-08-31 23:18 +07:00 | Viết tài liệu triển khai Kubernetes | Đã thực hiện | Tạo `kubernetes/manifests/README.md` với quy trình build, import image, apply, kiểm tra, troubleshooting và cleanup. Commit `a47ce3d`. |
| 2026-08-31 23:20 +07:00 | Import Docker images vào k3d | Đã xác minh | Import thành công 2 image `philobiblus-backend:local` và `philobiblus-frontend:local` vào cluster `philobiblus`. |
| 2026-08-31 23:30 +07:00 | Apply workload và kiểm tra ứng dụng | Đã xác minh | 2 node ở trạng thái `Ready`; PostgreSQL, backend và frontend đều `1/1 Running`; các Service và Traefik Ingress hoạt động. |
| 2026-08-31 23:30 +07:00 | Smoke test Kubernetes | Đã xác minh | Frontend HTTP `200`, public books API HTTP `200`, backend `/health` kiểm tra nội bộ Pod HTTP `200`. |

---

### Thứ tự ưu tiên (nếu không đủ thời gian)

| Mức độ | Hạng mục |
|---|---|
| Bắt buộc | Dashboard công khai `/dashboard` |
| Bắt buộc | User profile `/users/:username` |
| Bắt buộc | Chuẩn hóa frontend bằng Tailwind CSS và shadcn/ui |
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

## V. Cập nhật tiến độ thực tế — 31/08/2026

### Trạng thái hoàn thành tuần 10

| Hạng mục | Trạng thái thực tế | Bằng chứng |
|---|---|---|
| Public dashboard và public user profile | ✅ Hoàn thành | Backend endpoint, frontend route và test đã có |
| Tailwind CSS và shadcn/ui | ✅ Hoàn thành | Các page/component frontend chính đã chuyển sang Tailwind/shadcn; không còn `style=` trong `frontend/src` |
| Build frontend | ✅ Đã xác minh | `npm run build` thành công với 2075 modules transformed |
| Seed data local development | ⚠️ Đã viết, chưa xác minh runtime | `docker compose config` thành công; chưa kiểm tra insert thực tế vào PostgreSQL |
| Đánh giá và bình luận | ✅ Đã triển khai và xác minh | Có model, schema, router, review service, UI, nút xóa review chính chủ; 23 backend test pass gồm 4 review tests |
| Kubernetes manifests | ✅ Hoàn thành | Đã viết và commit trong `d901171` |
| Kubernetes deployment documentation | ✅ Hoàn thành | Đã viết `kubernetes/manifests/README.md` trong commit `a47ce3d` |
| Kubernetes local deployment | ✅ Đã xác minh | 2 node `Ready`, 3 Pod `Running`, Service/Ingress hoạt động; frontend HTTP `200`, public books API HTTP `200`, backend health nội bộ HTTP `200` |
| Kết bạn và theo dõi | ⏸ Trì hoãn | Thực hiện sau review/comment và Kubernetes |

### Commit refactor frontend ngày 31/08

| Commit | Nội dung |
|---|---|
| `1a2a470` | Refactor book forms sang shadcn |
| `94de875` | Refactor book detail sang shadcn |
| `0b8a9f4` | Refactor book dialog sang shadcn |
| `fdd38e5` | Loại bỏ inline style trong user profile |
| `ae28aea` | Refactor legacy dashboard sang shadcn |
| `59123a6` | Thêm Review API backend |
| `f82f1ae` | Thêm review UI và xóa review chính chủ |
| `d901171` | Thêm Kubernetes manifests |
| `a47ce3d` | Viết tài liệu deploy Kubernetes local |

### Kế hoạch bù tiến độ

1. Chạy `PYTHONPATH=. pytest -q` trong thư mục `backend`: **23 passed**.
2. Apply Kubernetes manifests: 2 node `Ready`, PostgreSQL/backend/frontend `1/1 Running`.
3. Kiểm tra frontend, public books API và backend `/health` bằng smoke test: đều phản hồi thành công.
4. Xác minh seed data hoặc ghi rõ dữ liệu được tạo thủ công trong môi trường Kubernetes.
5. Cập nhật báo cáo tuần 10 dựa trên kết quả kiểm thử thực tế.

## VI. Kế hoạch tuần 11 (01–07/09/2026)

### Mục tiêu tuần

Tuần 11 tập trung hoàn thiện trải nghiệm sản phẩm trước khi mở rộng DevOps: hoàn chỉnh social graph, bổ sung dashboard cá nhân, nâng cấp thư viện sách, quản lý tiến độ đọc, cải thiện review và duy trì khả năng triển khai bằng Docker/Kubernetes. Helm chart và Prometheus/Grafana được thực hiện sau các luồng sản phẩm bắt buộc, tùy theo thời gian còn lại. Mỗi thay đổi được kiểm thử tại tầng backend, build frontend và ít nhất một môi trường triển khai trước khi ghi nhận hoàn thành.

### Trạng thái đầu tuần

| Hạng mục | Trạng thái | Bằng chứng |
|---|---|---|
| Social graph backend và authorization | ✅ Hoàn thành | Commit `beac81e`; pytest social graph đã chạy trong baseline |
| Social flow frontend | ✅ Hoàn thành | Commit `208471b`, `99f57cc`; profile có follow, friend request incoming/outgoing |
| Navbar persistence, active route và account dropdown | ✅ Hoàn thành | Commit `fab955b`, `3b3039b`, `3bf76b8` |
| Rating bằng năm ngôi sao | ✅ Hoàn thành | Commit `8068b5a` |
| Multi-tag cho sách | ✅ Hoàn thành phần code | Commit `cda1d6a`; cần chạy migration `tags` trên PostgreSQL hiện tại |
| Chuẩn hóa nhãn trạng thái đọc | ✅ Hoàn thành | Commit `cc85d9d` |
| Public dashboard, user profile, review và Kubernetes manifests | ✅ Hoàn thành | Các commit public/review/Kubernetes trong lịch sử repository |

### Phạm vi và nguyên tắc thiết kế

| Hạng mục | Quy ước triển khai | Tiêu chí chấp nhận |
|---|---|---|
| Theo dõi | Quan hệ một chiều giữa `follower` và `followed`; không cần phê duyệt. Một người dùng không thể theo dõi chính mình hoặc tạo quan hệ trùng lặp. | Trạng thái theo dõi và số lượng follower/following trả về đúng theo dữ liệu của từng tài khoản. |
| Kết bạn | Quan hệ hai chiều có vòng đời `pending` → `accepted`; chỉ người nhận yêu cầu mới được chấp nhận. Hủy yêu cầu hoặc hủy kết bạn phải do một trong hai bên tham gia quan hệ thực hiện. | Không thể gửi yêu cầu cho chính mình, gửi trùng, chấp nhận yêu cầu không thuộc về mình hoặc thao tác lên quan hệ không tồn tại. |
| Dữ liệu công khai | Profile chỉ hiển thị trường an toàn, danh sách sách công khai và thông tin quan hệ cần thiết; không trả email, mật khẩu mã hóa hoặc JWT. | Các API public không làm lộ dữ liệu riêng tư và vẫn trả `404` rõ ràng với username không tồn tại. |
| Khả năng quan sát | Metrics ứng dụng chỉ được Prometheus nội bộ thu thập; không thêm route metrics vào Ingress public. | Prometheus lấy được metrics backend, Grafana hiển thị được dashboard có dữ liệu thực. |

### Ngày 1 — Rà soát baseline và chốt hợp đồng API (Hoàn thành)

**Rà soát chất lượng hiện có**

- Chạy `PYTHONPATH=. pytest -q` từ thư mục `backend` để tạo baseline cho 23 test hiện có; xử lý lỗi môi trường riêng biệt với lỗi sản phẩm.
- Chạy `npm run build` trong `frontend`; kiểm tra các route `/dashboard`, `/users/:username`, `/books/:id` và review trên dữ liệu seed hoặc dữ liệu thử nghiệm.
- Chạy `docker compose config`; xác minh service `db-seed` insert được users/books thực tế trước khi dùng dữ liệu này cho kiểm thử giao diện.

**Chốt API cho social graph**

- Lập sơ đồ dữ liệu `follows` và `friendships`, bao gồm foreign key, unique constraint/index cần có và quan hệ SQLAlchemy từ `User`.
- Xác định các endpoint: `POST`/`DELETE /api/users/{username}/follow`, `GET /api/users/{username}/relationship`, `GET /api/users/{username}/followers`, `GET /api/users/{username}/following`, `POST /api/users/{username}/friend-requests`, `GET /api/users/me/friend-requests`, `PUT /api/friendships/{id}/accept` và `DELETE /api/friendships/{id}`.
- Quy định thống nhất response schema cho profile, trạng thái quan hệ và danh sách người dùng để frontend không phụ thuộc vào ORM model trực tiếp.

**Kết quả bàn giao trong ngày:** baseline test/build có log, đặc tả endpoint và các trường dữ liệu đã được ghi trong code hoặc tài liệu API.

### Ngày 2 — Backend: theo dõi, kết bạn và kiểm soát quyền (Hoàn thành)

**Mô hình và schema**

- Bổ sung model `Follow` và `Friendship`, relationship hai chiều cần thiết trong `backend/app/models.py`, cùng schema request/response tại `backend/app/schemas.py`.
- Áp dụng unique constraint để chặn follow trùng lặp; duy trì thứ tự nhất quán của cặp user trong friendship để tránh hai yêu cầu kết bạn ngược chiều cho cùng một cặp tài khoản.
- Kiểm tra cơ chế tạo bảng hiện tại của ứng dụng trên cơ sở dữ liệu mới; ghi rõ phương án tương thích schema trước khi chạy với dữ liệu PostgreSQL đang tồn tại.

**Router và authorization**

- Tạo `backend/app/routers/social.py` hoặc tách router theo trách nhiệm, sau đó đăng ký tại `backend/app/main.py`.
- Bắt buộc JWT cho mọi thao tác thay đổi quan hệ; kiểm tra người dùng đích tồn tại, cấm thao tác với chính mình, kiểm tra quyền người nhận khi accept và quyền thành viên khi xóa.
- Trả mã lỗi nhất quán: `400` cho request không hợp lệ, `403` cho thao tác không có quyền, `404` cho tài nguyên không tồn tại và `409` cho quan hệ trùng/trạng thái xung đột.

**Kết quả bàn giao trong ngày:** API social graph có thể gọi bằng OpenAPI/curl và không làm thay đổi hành vi của auth, books, users hoặc reviews hiện có.

### Ngày 3 — Backend tests và frontend social flow (Hoàn thành)

**Kiểm thử backend**

- Bổ sung pytest cho follow/unfollow, tạo–accept–hủy friend request, danh sách incoming/outgoing request, quan hệ trùng, tự thao tác, username không tồn tại và truy cập trái quyền.
- Chạy toàn bộ test suite bằng `PYTHONPATH=. pytest -q`; chỉ ghi nhận số lượng test hoặc trạng thái pass sau khi có output thực tế.

**Tích hợp frontend**

- Tạo `frontend/src/services/socialServices.js` để tập trung các lời gọi API social graph và tái sử dụng token từ auth context.
- Cập nhật `UserProfilePage.jsx`: hiển thị nút Follow/Unfollow, Add friend/Cancel request/Accept request theo `relationship` thực tế; không hiển thị các nút này khi xem profile của chính mình.
- Bổ sung danh sách followers, following và friend requests trong giới hạn phân trang; hiển thị loading, empty state và lỗi API rõ ràng.
- Rà soát `BookDetailPage.jsx`, `PublicDashboardPage.jsx` và `UserProfilePage.jsx` để liên kết tác giả sách, review và public profile nhất quán, không làm lộ thông tin riêng tư.

**Kết quả bàn giao trong ngày:** người dùng có thể hoàn thành luồng follow và friend request từ giao diện, sau đó frontend build thành công.

### Ngày 4 — Xác minh Docker Compose và chuẩn bị Helm chart

**Docker Compose**

- Khởi chạy stack bằng `docker compose up --build`, kiểm tra health của backend, truy cập frontend qua Nginx và gọi `/api/books/public`.
- Xác minh dữ liệu seed theo cách có thể lặp lại; nếu seed không idempotent hoặc không chạy được, sửa script/cấu hình trước khi dùng làm dữ liệu kiểm thử.
- Thực hiện smoke test các luồng đăng nhập, public profile, review và social graph; lưu kết quả kiểm tra thay vì suy diễn từ trạng thái container.

**Helm**

- Khởi tạo đầy đủ `kubernetes/helm/philobiblus/` với `Chart.yaml`, `values.yaml`, `templates/` và `templates/tests/`.
- Chuyển các manifest namespace, PostgreSQL/PVC/Secret, backend, frontend, Service và Ingress thành template; đưa image repository/tag, tài nguyên, replica, host ingress và cấu hình database vào `values.yaml`.
- Tách Secret khỏi giá trị mẫu công khai: dùng `existingSecret` hoặc file values không commit cho thông tin nhạy cảm; không đưa credential thực vào chart hay tài liệu.
- Chạy `helm lint` và `helm template` để kiểm tra render trước khi cài đặt vào cluster.

**Kết quả bàn giao trong ngày:** Docker Compose có smoke-test thực tế và Helm chart render không lỗi với values local.

### Ngày 5 — Triển khai Helm trên Kubernetes local

- Build image backend/frontend, import đúng tag vào k3d và cấu hình `values.local.yaml` để chart sử dụng image local, không kéo image không tồn tại từ registry.
- Cài hoặc nâng cấp release bằng `helm upgrade --install`; kiểm tra namespace, Deployment, Pod, Service, PVC và Ingress đến trạng thái mong đợi.
- Thực hiện smoke test qua Ingress: frontend, `GET /api/books/public`, health nội bộ `/health`, đăng nhập và một luồng social graph.
- So sánh tài nguyên render từ Helm với manifests gốc; cập nhật README với quy trình cài đặt, nâng cấp, rollback và gỡ release an toàn.

**Kết quả bàn giao trong ngày:** một lần triển khai Helm có thể lặp lại trên k3d, kèm log trạng thái workload và kết quả smoke test.

### Ngày 6 — Prometheus và Grafana

**Instrumentation ứng dụng**

- Thêm metrics HTTP cho FastAPI gồm tổng request, thời gian phản hồi và mã trạng thái; chuẩn hóa label path để tránh tạo quá nhiều time series từ ID/username động.
- Expose `/metrics` tại backend và cấu hình Service để Prometheus nội bộ scrape endpoint này; không thêm route vào Ingress public.
- Bổ sung dependency, test tối thiểu cho endpoint metrics và tài liệu hóa các metric tự xây dựng.

**Cấu hình Kubernetes monitoring**

- Hoàn thiện `monitoring/prometheus-values.yaml` cho stack Prometheus/Grafana được chọn, bật thu thập metrics backend bằng ServiceMonitor hoặc cấu hình scrape tương đương.
- Hoàn thiện `monitoring/grafana-dashboard.json` với các panel: request rate, tỷ lệ lỗi 4xx/5xx, p95 latency, trạng thái target/pod và mức sử dụng CPU/memory của workload.
- Cài đặt trên k3d, xác minh target backend ở trạng thái `UP`, tạo lưu lượng thử nghiệm và kiểm tra dashboard có dữ liệu thay đổi theo lưu lượng đó.

**Kết quả bàn giao trong ngày:** Prometheus scrape được backend và Grafana import/hiển thị dashboard có dữ liệu xác minh.

### Ngày 7 — Regression, tài liệu và tổng kết tuần

- Chạy regression cuối tuần: backend pytest, frontend build, `docker compose config`, `helm lint`, `helm template` và smoke test trên Kubernetes Helm release.
- Kiểm tra lại authorization của books, reviews và social graph bằng hai tài khoản khác nhau; đặc biệt xác minh user không thể xóa review hoặc thay đổi friendship của tài khoản khác.
- Cập nhật README/triển khai với biến môi trường, dependency, lệnh kiểm thử, kiến trúc Helm và cách truy cập monitoring; loại bỏ token, mật khẩu và artifact build khỏi Git.
- Tổng hợp bằng chứng thực tế cho báo cáo tuần 11: commit liên quan, output test/build, trạng thái Kubernetes/Prometheus và ảnh dashboard nếu có. Nội dung chưa xác minh phải ghi rõ là chưa xác minh hoặc chuyển sang tuần sau.

### Thứ tự ưu tiên và tiêu chí hoàn thành

| Mức độ | Hạng mục | Hoàn thành khi |
|---|---|---|
| Bắt buộc | Dashboard cá nhân | Hiển thị số liệu sách, trạng thái đọc, tổng trang và tiến độ theo thời gian. |
| Bắt buộc | Thư viện sách nâng cấp | Tìm kiếm, lọc theo status/tag, sắp xếp và phân trang hoạt động đúng. |
| Bắt buộc | Quản lý tiến độ đọc | Cập nhật trang đã đọc, tự động xử lý status và ngày bắt đầu/hoàn thành. |
| Bắt buộc | Review hoàn chỉnh | Hiển thị rating trung bình, ngăn review trùng và xử lý quyền sửa/xóa. |
| Quan trọng | Social completion | Danh sách bạn bè, thông báo friend request và activity feed cơ bản. |
| Quan trọng | Docker Compose và Helm | Có smoke test thực tế; Helm đạt `lint`, `template` và deploy local nếu còn thời gian. |
| Có thể chuyển sang tuần sau | Prometheus/Grafana nâng cao, Alertmanager, CI/CD deploy tự động | Chỉ thực hiện sau khi các luồng sản phẩm bắt buộc và regression đã ổn định. |

### Rủi ro và cách kiểm soát

| Rủi ro | Cách kiểm soát |
|---|---|
| Schema mới xung đột dữ liệu PostgreSQL đang có | Kiểm tra trên database mới trước, sao lưu dữ liệu local khi cần và ghi rõ phương án cập nhật schema. |
| Image local không được Helm/Kubernetes tìm thấy | Dùng tag cố định, import image vào đúng k3d cluster và đặt `imagePullPolicy` phù hợp cho values local. |
| Metrics tạo label cardinality cao hoặc bị public qua Ingress | Chỉ gắn label có tập giá trị hữu hạn, chuẩn hóa route và giới hạn endpoint `/metrics` trong Service nội bộ. |
| Scope vượt quá thời lượng tuần | Ưu tiên social graph, regression và Helm; phần alerting/CI-CD tự động chỉ thực hiện khi các tiêu chí bắt buộc đã đạt. |

## VII. Rà soát commit và điều chỉnh kế hoạch sau ngày 05/09/2026

### Trạng thái tính năng theo lịch sử commit

| Nhóm | Trạng thái hiện tại | Commit/bằng chứng |
|---|---|---|
| Auth và CRUD thư viện sách | ✅ Đã có | `a2878f2`, `2357540`, `399a48c`; đã có trang danh sách, thêm, sửa, xóa và detail |
| Dashboard công khai và profile công khai | ✅ Đã có | `49cbf22`, `1dfad25`, `da42315`; có feed sách public và profile chỉ đọc |
| Dashboard cá nhân/statistics | ✅ Đã có phần nền | `83c8143`; có tổng sách, status, tổng trang, rating trung bình và progress tổng |
| Rating bằng sao, nhiều tag, nhãn status | ✅ Đã có | `8068b5a`, `cda1d6a`, `cc85d9d` |
| Visibility Public/Restricted/Private | ✅ Đã có phần mã nguồn | `a12f486`, `d619fb1`; có lọc public, share token và trang detail qua link; cần xác minh migration trên database PostgreSQL hiện tại |
| Review | ⚠️ Mới hoàn thành nền tảng | `59123a6`, `f82f1ae`; còn rating trung bình, số lượng, sửa review và unique constraint chống đánh giá trùng |
| Social graph | ✅ Đã có luồng nền tảng | `beac81e`, `208471b`, `99f57cc`, `6058917`; còn activity feed, thông báo rõ ràng và tìm kiếm user |
| Navbar và account dropdown | ✅ Đã có | `fab955b`, `3b3039b`, `3bf76b8`, `aa34612` |
| Helm chart | ✅ Đã viết, chưa xác minh runtime | `9141b0d`; cần `helm lint`, `helm template` và deploy local thực tế |
| Prometheus metrics | ✅ Đã viết, chưa xác minh runtime | `8b4e00f`; có endpoint `/metrics` và test, chưa có bằng chứng Prometheus/Grafana scrape thành công |
| CI | ✅ Có baseline | `67c5356` chạy backend test; chưa mở rộng pipeline cho frontend build và image/deploy |

### Ưu tiên sản phẩm còn thiếu

Các hạng mục dưới đây được làm trước hạ tầng vì ảnh hưởng trực tiếp đến trải nghiệm đọc sách:

1. Lịch sử đọc sách theo ngày, trang/chương/tập.
2. Cập nhật tiến độ nhanh, tự động chuyển status và lưu ngày bắt đầu/ngày hoàn thành.
3. Nâng cấp thư viện: nhiều tag, sort, pagination, loading và empty state.
4. Hoàn thiện review: rating trung bình, số lượng, sửa review và chặn review trùng.
5. Hoàn thiện social: danh sách bạn bè, thông báo và activity feed tối thiểu.
6. Account/profile: avatar, thông tin tài khoản, đổi mật khẩu và privacy profile.

### Kế hoạch những ngày tiếp theo

#### Ngày 1 — Reading history (tính năng đang triển khai)

- Thêm bảng `reading_history` liên kết với `books` và `users`.
- Bổ sung API tạo và lấy lịch sử của chính chủ sách; mỗi bản ghi lưu `read_on`, `pages_read`, `chapter`, `volume`, `note`.
- Thêm migration PostgreSQL và test ownership, validation và thứ tự mới nhất trước.
- Hiển thị form ghi nhận và list lịch sử trong Book Detail.

**Tiêu chí hoàn thành:** người dùng lưu được nhiều mốc đọc và nhìn thấy đúng ngày cùng trang/chương/tập tương ứng; user khác không đọc được lịch sử của sách private.

#### Ngày 2 — Progress workflow

- Thêm nút tăng/giảm trang đã đọc và cập nhật nhanh không cần mở form dài.
- Khi bắt đầu đọc, tự chuyển `want_to_read` → `reading` và ghi `date_started`.
- Khi đạt `pages_total`, tự chuyển `reading` → `completed` và ghi `date_finished`.
- Đồng bộ mỗi lần cập nhật progress vào reading history nếu người dùng xác nhận lưu mốc đọc.

**Tiêu chí hoàn thành:** progress, status và hai ngày đọc luôn nhất quán sau create/update/reload.

#### Ngày 3 — Library usability

- Bổ sung lọc nhiều tag ở backend và frontend.
- Thêm sort theo title, rating, created date và progress; validate whitelist sort field ở backend.
- Kết nối pagination thật với `skip/limit` và tổng số bản ghi.
- Hoàn thiện loading skeleton, empty state, lỗi API và debounce cho ô tìm kiếm.

**Tiêu chí hoàn thành:** thư viện xử lý đúng kết hợp search + status + nhiều tag + sort + pagination trên dữ liệu lớn hơn một trang.

#### Ngày 4 — Review completion

- Tạo unique constraint `(book_id, user_id)` và migration an toàn cho dữ liệu review hiện có.
- Thêm endpoint sửa review chính chủ và cập nhật UI.
- Trả về `average_rating` và `review_count` trong detail/public response.
- Bổ sung test duplicate, update ownership và tính toán aggregate.

**Tiêu chí hoàn thành:** một user chỉ có một review cho một sách và có thể sửa review của mình.

#### Ngày 5 — Social completion

- Hiển thị danh sách bạn bè accepted và trạng thái quan hệ rõ ràng.
- Bổ sung thông báo friend request/follow với trạng thái đã đọc.
- Tạo activity feed tối thiểu cho thêm sách, review và thay đổi status.
- Thêm tìm kiếm user có pagination và test authorization.

**Tiêu chí hoàn thành:** user tìm được người khác, xem được bạn bè/thông báo và feed không làm lộ dữ liệu private.

#### Ngày 6 — Account, profile và privacy

- Upload/đổi avatar với giới hạn loại file và kích thước.
- Sửa username/email, đổi mật khẩu và buộc xác thực mật khẩu hiện tại.
- Tách privacy profile khỏi visibility của từng sách; áp dụng filter ở API profile.
- Bổ sung test dữ liệu nhạy cảm không xuất hiện trong public response.

**Tiêu chí hoàn thành:** account settings hoạt động, dữ liệu riêng tư không xuất hiện ở dashboard/profile/public detail.

#### Ngày 7 — Regression và mới quay lại hạ tầng

- Chạy backend pytest, frontend build, Docker Compose smoke test và kiểm tra migration trên PostgreSQL.
- Nếu toàn bộ tính năng bắt buộc đạt, chạy `helm lint`, `helm template`, deploy Helm local và xác minh rollout.
- Sau đó mới bật Prometheus/Grafana, hoàn thiện dashboard monitoring và mở rộng CI cho frontend build.
- Backup PostgreSQL và CI/CD deploy tự động chuyển sang phase hạ tầng kế tiếp nếu chưa đủ bằng chứng runtime.

### Quy tắc ghi nhận tiến độ

- Chỉ đánh dấu ✅ khi có output test/build/smoke test hoặc bằng chứng API thực tế.
- Phân biệt rõ “đã viết mã nguồn” với “đã xác minh runtime”.
- Mỗi tính năng sản phẩm có commit riêng; không gom code tính năng với Helm, monitoring hoặc tài liệu triển khai trong cùng commit.

### Cập nhật tiến độ — 03/09/2026

| Hạng mục | Trạng thái | Bằng chứng |
|---|---|---|
| Thiết kế social graph | ✅ Hoàn thành | Tách quan hệ theo dõi một chiều (`Follow`) và kết bạn hai chiều (`Friendship`); áp dụng constraint chống tự thao tác, follow trùng và friendship trùng. |
| Social graph API | ✅ Hoàn thành | Bổ sung follow/unfollow, xem relationship, followers/following, tạo/xem/accept/hủy friend request; các thao tác thay đổi đều yêu cầu JWT và kiểm tra quyền. |
| Schema và đăng ký ứng dụng | ✅ Hoàn thành | Bổ sung response schema cho follow/friendship/relationship, đăng ký social router trong FastAPI. |
| Backend automated tests | ✅ Đã xác minh | Chạy `PYTHONPATH=. pytest -q` thành công: **28 passed**; có 2 warning deprecation từ dependency, không phải lỗi kiểm thử. |
| Commit backend social graph | ✅ Hoàn thành | Commit `beac81e` — `feat(social): add follow and friendship APIs`. |
| Frontend social flow | ✅ Hoàn thành | `socialServices.js`, `UserProfilePage.jsx` và `SocialPage.jsx` đã hỗ trợ follow, friend request incoming/outgoing, followers và following; frontend build thành công. |

### Cập nhật tiến độ thực tế — 04/09/2026

Các thay đổi giao diện và dữ liệu sách phát sinh sau mốc 03/09 được ghi nhận như sau:

| Hạng mục | Trạng thái | Bằng chứng |
|---|---|---|
| Rating dạng star selector | ✅ Hoàn thành | `BookForm`, `BookAddPage`, `BookEditPage` và review form dùng component `StarRating`; commit `8068b5a` |
| Tags dạng nhiều lựa chọn | ✅ Hoàn thành phần frontend/backend | `TagSelector` có danh sách tìm kiếm, tag đã chọn và badge hiển thị; model/schema có `tags`; commit `cda1d6a` |
| Hiển thị tag không còn card lớn | ✅ Hoàn thành | `BookCard` và `BookDetailPage` hiển thị tag bằng badge nhỏ; commit `cda1d6a` |
| Nhãn trạng thái đọc | ✅ Hoàn thành | Dùng helper thống nhất, không còn hiển thị raw `want_to_read`; commit `cc85d9d` |
| Frontend build sau các thay đổi sách | ✅ Đã xác minh | `npm run build`: 2081 modules transformed |
| Backend test sau khi thêm column `tags` | ⏳ Chưa xác minh | Cần chạy lại `PYTHONPATH=. pytest -q` trong môi trường WSL/Docker có dependency |

### Điều chỉnh nội dung còn lại trong tuần 11

Do social graph và giao diện sách đã hoàn thành, phần thời gian còn lại ưu tiên tính năng tạo giá trị trực tiếp cho người dùng:

1. **Dashboard cá nhân:** thống kê số sách theo status, tổng trang đã đọc, rating trung bình và tiến độ đọc.
2. **Thư viện nâng cấp:** tìm kiếm theo tên/tác giả, lọc theo status và tag, sắp xếp, phân trang và empty state.
3. **Tiến độ đọc:** cập nhật nhanh `pages_read`, tự động chuyển status, lưu ngày bắt đầu/ngày hoàn thành.
4. **Review:** rating trung bình, số lượng review, sửa review và chặn một tài khoản review trùng một cuốn sách.
5. **Social completion:** danh sách bạn bè đã chấp nhận, thông báo friend request và activity feed tối thiểu.
6. **Regression và triển khai:** chạy lại Docker Compose, backend pytest, frontend build; sau đó tiếp tục Helm/monitoring nếu các hạng mục sản phẩm bắt buộc đã ổn định.

### Cập nhật tiến độ thực tế — 05/09/2026

| Hạng mục | Trạng thái | Bằng chứng / giới hạn xác minh |
|---|---|---|
| Helm chart Philobiblus | ✅ Hoàn thành phần mã nguồn | Khởi tạo `kubernetes/helm/philobiblus/` với chart metadata, values, template cho PostgreSQL/PVC, backend, frontend, Service, Ingress và Helm health test. |
| Quản lý Secret | ✅ Hoàn thành phần mã nguồn | Giá trị mặc định dùng `secrets.existingSecret`; `values.local.example.yaml` là mẫu không chứa credential thật và `values.local.yaml` bị Git ignore. |
| Tài liệu Helm | ✅ Hoàn thành | README chart ghi quy trình lint/template, cài đặt/upgrade, kiểm tra rollout, Helm test, rollback và uninstall an toàn. |
| Xác minh Helm CLI/Docker | ⏳ Chưa thể thực hiện tại máy hiện tại | Helm CLI không có trong PATH; Docker Desktop daemon không chạy nên không thể dùng image Helm để chạy `helm lint` và `helm template`. Chưa ghi nhận chart đã render hoặc deploy thành công. |
| FastAPI metrics nội bộ | ✅ Hoàn thành phần mã nguồn | Bổ sung `prometheus-fastapi-instrumentator`, expose `/metrics` ngoài OpenAPI, loại `/metrics` khỏi instrumentation và dựa trên route template để tránh label cardinality cao; thêm pytest cho endpoint. Chart có `ServiceMonitor` tùy chọn, mặc định tắt cho đến khi cluster có Prometheus Operator CRD. |

---

## VIII. Cập nhật tiến độ thực tế — 06/09/2026

### Tính năng sách và lịch sử đọc

| Hạng mục | Trạng thái | Bằng chứng / phạm vi |
|---|---|---|
| Thuộc tính tiến độ và phát hành sách | ✅ Hoàn thành phần mã nguồn | Commit `819c977`; bổ sung `chapters_read` dạng số thực, `publication_status`, trạng thái `dropped`, `date_started` và quy ước giá trị `-1` cho volume/trang/chương chưa nhập. |
| Hiển thị số liệu chưa nhập | ✅ Hoàn thành | Card, list, Book Detail và shared detail không hiển thị các giá trị sentinel `-1`. |
| Migration và seed | ✅ Hoàn thành phần mã nguồn | Seed cập nhật các trường mới; job seed tự chạy migration idempotent trước khi nạp dữ liệu. Cần xác minh trên PostgreSQL bằng Docker Compose. |
| Lịch sử đọc tự động | ✅ Hoàn thành phần mã nguồn | Commit `ae80d44`, `819c977`; backend chỉ tạo mốc khi thay đổi `pages_read`, `chapters_read` hoặc `volume`. |
| Mốc bắt đầu đọc | ✅ Hoàn thành | Commit `7c599db`; frontend tạo mốc đầu danh sách trực tiếp từ `book.date_started`, không lưu thành bản ghi lịch sử và không cho phép xóa. Ô chọn ngày bắt đầu đọc mặc định là ngày hiện tại khi thêm sách. |
| Xóa lịch sử đọc | ✅ Hoàn thành | Commit `690f9e7`; chủ sách có thể xóa từng mốc hoặc toàn bộ mốc tiến độ, có xác nhận trước khi xóa. Mốc bắt đầu đọc do frontend tạo không bị ảnh hưởng. |
| Hiển thị lịch sử đọc | ✅ Hoàn thành | Danh sách được giới hạn chiều cao và cuộn dọc trong Book Detail. |

### Trải nghiệm thư viện sách

| Hạng mục | Trạng thái | Bằng chứng / phạm vi |
|---|---|---|
| Chế độ Card/List | ✅ Hoàn thành | Commit `eeb92f0`; Library, Statistics dashboard, Public Dashboard và Public Library trên profile đều có bộ chọn Card/List dùng chung. List giữ bìa, trạng thái, tag, tiến độ và action theo quyền. |
| Rating bằng sao, multi-tag, trạng thái đọc và visibility | ✅ Hoàn thành | Các commit `8068b5a`, `cda1d6a`, `cc85d9d`, `a12f486`, `d619fb1`; cần regression trên PostgreSQL hiện có sau migration. |
| Frontend production build | ✅ Đã xác minh | `npm run build` thành công sau các thay đổi Reading History và Card/List (2087 modules transformed). |
| Backend regression mới nhất | ⏳ Chưa xác minh runtime | Môi trường hiện tại không có Python/pytest đầy đủ; lần chạy WSL thiếu dependency `prometheus_fastapi_instrumentator`. Cần chạy trong backend Docker image hoặc môi trường WSL đã cài requirements. |

### Helm chart

| Hạng mục | Trạng thái | Bằng chứng / phạm vi |
|---|---|---|
| Cấu trúc chart | ✅ Hoàn thành phần mã nguồn | Commit `9141b0d`; chart tại `kubernetes/helm/philobiblus/` có `Chart.yaml`, values công khai/local mẫu, README và helpers. |
| Workload được template hóa | ✅ Hoàn thành | Có PostgreSQL + PVC, backend, frontend, Service, Ingress, Secret tùy chọn, Helm health test, seed hook Job và ServiceMonitor tùy chọn. |
| Quản lý secret | ✅ Hoàn thành phần mã nguồn | Mặc định dùng `secrets.existingSecret`; values local mẫu không chứa credential thật. |
| Helm lint/template | ✅ Đã xác minh | Helm v4.2.4 trong WSL chạy `helm lint` thành công (chỉ khuyến nghị bổ sung chart icon); `helm template` render thành công với values validation và có manifest Job `philobiblus-seed`. |
| Seed hook Job | ✅ Đã xác minh bằng render | Chạy sau `post-install` và mặc định cả `post-upgrade`; chờ PostgreSQL, dùng backend image để chạy `python -m scripts.seed_database`, có `backoffLimit` và giữ Job để đọc log đến lần deploy kế tiếp. |

### Kế hoạch ưu tiên sau ngày 06/09/2026

1. Chạy regression trong Docker/WSL: backend pytest, frontend build, Docker Compose smoke test và xác minh migration + seed trên PostgreSQL thật.
2. Hoàn thiện workflow tiến độ: tự chuyển status theo tiến độ, quản lý `date_finished`, và kiểm tra tính nhất quán của history sau create/update/delete.
3. Hoàn thiện thư viện: tìm kiếm frontend, lọc nhiều tag/status, sort, pagination, loading và empty state.
4. Hoàn thiện review: unique constraint `(book_id, user_id)`, sửa review, rating trung bình và số lượng review.
5. Hoàn thiện social/account: danh sách bạn bè accepted, tìm kiếm user, activity feed tối thiểu, avatar và account settings.
6. Chỉ sau khi các luồng sản phẩm ổn định: cài Helm CLI, chạy `helm lint` + `helm template`, triển khai thử lên k3d, sau đó mới xác minh Prometheus/Grafana và mở rộng CI chạy frontend build.

---

## IX. Kế hoạch tuần 12 — Observability và frontend GitHub Pages

### Bối cảnh và phạm vi

Helm release `philobiblus` đã được triển khai thành công trên cụm k3d local: PostgreSQL, backend và frontend ở trạng thái Running; PersistentVolumeClaim ở trạng thái Bound; seed Job hoàn thành. Tuần 12 ưu tiên xác minh observability trên chính cụm này và thử nghiệm phân phối frontend tĩnh qua GitHub Pages.

GitHub Pages chạy trên HTTPS nên không thể gọi trực tiếp backend bằng `http://localhost`: `localhost` sẽ trỏ đến máy của từng người truy cập, đồng thời trình duyệt chặn mixed content từ trang HTTPS đến API HTTP. Vì vậy, luồng GitHub Pages chỉ được coi là hoàn thành khi frontend sử dụng một endpoint HTTPS công khai/tunnel trỏ an toàn về backend local. PostgreSQL, `/metrics`, Secret và Kubernetes API không được công bố qua tunnel.

### Ngày 1 — Rà soát metrics và chuẩn bị monitoring stack

- Xác minh endpoint `/metrics` của backend qua Service nội bộ, kiểm tra metric HTTP có route template và không phát sinh label từ ID hoặc username động.
- Rà soát Service, ServiceMonitor và Helm values hiện tại; giữ `monitoring.serviceMonitor.enabled=false` cho đến khi Prometheus Operator CRD được cài đặt.
- Chuẩn bị values riêng cho kube-prometheus-stack, không ghi credential Grafana, token hay cấu hình local nhạy cảm vào Git.
- Kiểm tra lại tài nguyên k3d trước khi cài stack; điều chỉnh request/limit của frontend nếu cần để tránh lặp lại lỗi OOMKilled.

**Tiêu chí hoàn thành:** tài liệu rõ endpoint scrape, chart values không chứa secret và cluster đủ tài nguyên cho monitoring.

### Ngày 2 — Cài Prometheus và kết nối backend target

- Cài kube-prometheus-stack trên namespace riêng bằng Helm.
- Bật ServiceMonitor của Philobiblus hoặc cấu hình scrape tương đương sau khi CRD đã sẵn sàng.
- Xác minh Prometheus target của backend ở trạng thái `UP`, endpoint scrape là `/metrics` và metrics không đi qua Ingress public.
- Tạo lưu lượng kiểm thử tới các API hợp lệ và không hợp lệ để có dữ liệu request/response phục vụ dashboard.

**Tiêu chí hoàn thành:** Prometheus thu thập được metrics backend liên tục và target backend hiển thị `UP`.

### Ngày 3 — Dashboard Grafana và kiểm chứng dữ liệu

- Hoàn thiện dashboard Grafana với các panel: request rate, tỷ lệ lỗi 4xx/5xx, p95 latency, trạng thái target/pod và CPU/memory của workload.
- Import dashboard vào Grafana, tạo lưu lượng kiểm thử và xác minh các panel thay đổi theo lưu lượng thực tế.
- Lưu dashboard JSON đã loại bỏ datasource UID hoặc thông tin cài đặt riêng; chụp bằng chứng target Prometheus và dashboard có dữ liệu.

**Tiêu chí hoàn thành:** Grafana hiển thị tối thiểu các chỉ số request, lỗi, latency và tình trạng workload bằng dữ liệu từ cluster local.

### Ngày 4 — Chuẩn bị frontend production và GitHub Pages

- Rà soát frontend để bảo đảm `VITE_API_URL` được inject khi build production, không phụ thuộc Vite dev server hoặc biến môi trường chỉ có trong Docker Compose/k3d.
- Tạo GitHub Actions workflow build frontend và publish artifact tĩnh lên GitHub Pages; cấu hình base path phù hợp với repository Pages.
- Giữ URL API trong GitHub Actions variable hoặc cấu hình không nhạy cảm; không đưa JWT, database password hoặc `.env` local vào workflow.
- Xác minh GitHub Pages render được frontend tĩnh, route frontend và asset hoạt động đúng sau deploy.

**Tiêu chí hoàn thành:** GitHub Pages build/deploy thành công và giao diện frontend tải được toàn bộ asset production.

### Ngày 5 — Kết nối GitHub Pages với backend local qua HTTPS

- Thiết lập tunnel HTTPS có xác thực/truy cập phù hợp từ Internet đến backend local; chỉ expose API cần thiết, không expose database hoặc `/metrics`.
- Cập nhật `VITE_API_URL` thành endpoint HTTPS tunnel, cấu hình `ALLOWED_ORIGINS` cho đúng GitHub Pages origin và deploy lại frontend Pages.
- Kiểm tra từ trang GitHub Pages các luồng public; kiểm tra đăng nhập và một thao tác cần JWT để xác minh CORS, cookie/token và API URL hoạt động đúng.
- Ghi lại giới hạn của mô hình local backend: tunnel chỉ hoạt động khi máy local, Docker Desktop và k3d đang chạy.

**Tiêu chí hoàn thành:** frontend GitHub Pages gọi được backend local qua HTTPS tunnel, không có lỗi mixed content hoặc CORS và không làm lộ endpoint nội bộ.

### Ngày 6 — Regression, tài liệu và đánh giá an toàn

- Chạy backend pytest, frontend production build, `docker compose config`, `helm lint`, `helm template`, `helm test` và smoke test Helm release.
- Kiểm tra Prometheus target, dashboard Grafana, GitHub Pages URL và tunnel sau khi restart workload cần thiết.
- Cập nhật README với cách triển khai/rollback monitoring, cách cấu hình frontend Pages, các biến môi trường công khai và giới hạn khi backend chạy local.
- Rà soát Git history, workflow logs và repository để bảo đảm không có `.env`, `values.local.yaml`, password, JWT hoặc Grafana credential bị commit.

**Tiêu chí hoàn thành:** toàn bộ bằng chứng test/deploy được lưu lại; tài liệu tái hiện được deployment và không chứa thông tin nhạy cảm.

### Rủi ro tuần 12 và cách kiểm soát

| Rủi ro | Cách kiểm soát |
|---|---|
| k3d thiếu CPU/memory khi chạy thêm Prometheus và Grafana | Kiểm tra resource trước, dùng request/limit phù hợp và chỉ bật workload cần thiết. |
| ServiceMonitor không được nhận diện | Cài Prometheus Operator trước, kiểm tra CRD/label selector và xác minh target trực tiếp trong Prometheus. |
| GitHub Pages không gọi được API local | Dùng HTTPS tunnel; không dùng `localhost` làm API URL của Pages; cập nhật CORS theo origin Pages. |
| Lộ database, metrics hoặc secret qua tunnel/workflow | Chỉ expose API cần thiết; để `/metrics` nội bộ; dùng GitHub Actions variables/secrets và giữ file local bị Git ignore. |
| Tunnel ngừng hoạt động khi máy local tắt | Ghi rõ đây là demo/integration local, không coi là kiến trúc production. |
