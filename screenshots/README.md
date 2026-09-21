# Screenshot index

Các ảnh trong thư mục này ghi lại việc tạo Bootstrap và Foundation của hạ tầng Google Cloud cho project `grace-enhanced`, cùng một ảnh kiểm thử dashboard. Chúng là bằng chứng trực quan; trạng thái Terraform chính thức vẫn được kiểm tra bằng `terraform plan` và state bucket.

| File | Nội dung ảnh | Ý nghĩa cần đối chiếu |
| --- | --- | --- |
| `gcloud-bucket-state.png` | Cloud Storage bucket chứa Terraform state. | Xác nhận Bootstrap đã tạo bucket `grace-enhanced-tfstate-6515597414` ở `ASIA-SOUTHEAST1`, với uniform bucket-level access, public access prevention và object versioning. Bucket này chứa remote state của Foundation và Runtime. |
| `gcloud-vpc-subnet.png` | Chi tiết subnet của VPC Foundation. | Xác nhận subnet `philobiblus-dev-run` thuộc VPC `philobiblus-dev-vpc`, ở `asia-southeast1`, dùng dải `10.20.0.0/24`. Cloud Run runtime sẽ dùng subnet này cho Direct VPC egress. |
| `gcloud-vpc-private-service-access.png` | Private Service Access / VPC peering. | Xác nhận kết nối với `servicenetworking.googleapis.com`, cần cho Cloud SQL private IP. Không xóa peering khi Cloud SQL còn tồn tại. |
| `gcloud-sql-postgres.png` | Trang Cloud SQL instance. | Xác nhận instance PostgreSQL 16 `philobiblus-dev-postgres` đã được tạo trong `asia-southeast1`, có trạng thái chạy được và dùng private connectivity. |
| `gcloud-sql-database-philobiblus.png` | Mục **Databases** của instance Cloud SQL. | Xác nhận database ứng dụng `philobiblus` đã tồn tại. Database user `philobiblus_app` được tạo ở bước nạp secret sau Foundation. |
| `gcloud-artifact-registry.png` | Artifact Registry repository `philobiblus`. | Xác nhận Foundation đã tạo repository ở `asia-southeast1`. Repository đang không có image là hợp lệ vì đợt deploy hiện tại dùng image public trên Docker Hub. |
| `gcloud-service-account.png` | Danh sách service account của Foundation. | Xác nhận các identity cho backend, recommendation và seed job đã được tạo: `philobiblus-backend`, `philobiblus-recommend`, `philobiblus-seed`. Runtime sẽ gán các identity này cho Cloud Run service/job. |
| `gcloud-secret-manager.png` | Danh sách Secret Manager secret container. | Xác nhận Foundation tạo ba container: database URL, JWT secret và ImgBB API key. Ảnh không được dùng để lộ secret value; secret version chỉ được thêm ở bước nạp secret. |
| `dashboard-after-stress-test.png` | Dashboard ứng dụng sau kiểm thử tải. | Lưu lại giao diện dashboard sau stress test để đối chiếu hiển thị và khả năng đáp ứng của ứng dụng; không phải bằng chứng Terraform hoặc Google Cloud Foundation. |

## Resource names tham chiếu

- State bucket: `grace-enhanced-tfstate-6515597414`
- VPC: `philobiblus-dev-vpc`
- Run subnet: `philobiblus-dev-run`
- Cloud SQL: `philobiblus-dev-postgres`
- Database: `philobiblus`
- Artifact Registry repository: `philobiblus`

Không lưu password, JWT, ImgBB API key, access token hay nội dung Terraform state trong screenshot hoặc README này.
