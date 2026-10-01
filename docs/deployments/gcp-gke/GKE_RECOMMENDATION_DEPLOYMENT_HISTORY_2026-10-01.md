# Lịch sử khôi phục recommendation service trên GKE ngày 01 tháng 10 năm 2026

## Phạm vi

Khôi phục recommendation service thành Deployment độc lập trên cluster `philobiblus-dev-gke`, namespace `philobiblus`. Thay đổi không mở thêm route công khai. Backend tiếp tục gọi service qua địa chỉ nội bộ `http://philobiblus-recommendation:8080`.

## Nguyên nhân

Recommendation service từng chạy độc lập trong đợt kiểm thử tải ngày 24 tháng 9 năm 2026. Khi đo Redis cache và connection pool, cấu hình `recommendation.enabled` được chuyển sang `false` để cô lập tải backend và Cloud SQL. Giá trị tạm thời này còn tồn tại trong lần Terraform apply sau đó, vì vậy Helm xóa Deployment và Service khỏi cluster.

Lần bật lại đầu tiên phát hiện thêm hai lỗi đóng gói. Digest model-fetcher trên Docker Hub không còn tồn tại. Image model-fetcher được build lại nhưng thiếu `scikit-learn`, nên không thể giải tuần tự artifact TF-IDF để kiểm tra schema. Recommendation image cũ cũng chứa logic đọc model không khớp với schema 2 trong mã nguồn hiện tại.

## Thay đổi đã triển khai

| Hạng mục | Giá trị |
|---|---|
| Cluster | `gke_grace-enhanced_asia-southeast1_philobiblus-dev-gke` |
| Namespace | `philobiblus` |
| Helm release | `philobiblus`, revision 15 |
| Deployment | `philobiblus-recommendation`, 1 replica |
| Service | `philobiblus-recommendation`, ClusterIP, port 8080 |
| Model version | `tfidf-with-tags-v1` |
| Model SHA-256 | `aff364b5c119d37253ede48e68c61dbc0194f8f78d7bd5ec7ea3c13eb4bb00d4` |
| Recommendation image | `asia-southeast1-docker.pkg.dev/grace-enhanced/philobiblus/philobiblus-recommendation@sha256:e179b97c4ec95cd0b384438625caf951b0d71c573547b5318ed158678c445c84` |
| Model-fetcher image | `asia-southeast1-docker.pkg.dev/grace-enhanced/philobiblus/philobiblus-model-fetcher@sha256:d243151b57abef64a9c26b97b3be93902b6620447461633c42c3e650eead45b6` |

Model bootstrap được tái tạo bằng trainer image bất biến từ snapshot `catalog-e485ba4d8bcefff9b09d`. Snapshot có 100 sách; quá trình huấn luyện sinh 2.030 đặc trưng và `mean_top_k_similarity` bằng `0.17070663452161586`. Artifact schema 2 được lưu tại `gs://grace-enhanced-philobiblus-mlops/models/tfidf-with-tags-v1-schema2-bootstrap/model.joblib`. ConfigMap `model-release` giữ URI, phiên bản và checksum để init container kiểm tra trước khi công bố file model vào volume dùng chung.

Model-fetcher image bổ sung `scikit-learn==1.5.2`, cùng phiên bản với recommendation service. Hai image runtime được chuyển từ Docker Hub sang Artifact Registry của project và tham chiếu bằng digest.

## Kết quả xác minh

`kubectl rollout status` xác nhận Deployment rollout thành công. Trạng thái cuối là `1/1 Ready`, Pod `Running`, không có lần restart. Service có EndpointSlice trỏ tới Pod trên port 8080.

Backend Pod gọi trực tiếp endpoint nội bộ và nhận phản hồi:

```json
{"status":"ok","model_version":"tfidf-with-tags-v1"}
```

Inference với sách có `book_id=1` trả đủ năm kết quả, gồm các ID 24, 86, 8, 80 và 35. Mỗi phần tử có điểm cosine cùng `model_version=tfidf-with-tags-v1`; luồng kiểm tra không rơi về fallback.

Helm revision 15 ở trạng thái `deployed`. Terraform plan cuối trả về `No changes`, cho thấy trạng thái cluster khớp với cấu hình.

## Giới hạn còn lại

Các lần retrain gần nhất tạo được model và MLflow version nhưng quality gate trả về `insufficient_data` vì chưa có hồ sơ tương tác để đánh giá. Deployment hiện phục vụ model content-based bootstrap từ catalog công khai. Pipeline chỉ nên thay champion khi số hồ sơ đánh giá đạt ngưỡng cấu hình và candidate vượt qua quality gate.

## Ảnh hưởng tới báo cáo thực tập

Báo cáo thực tập đã mô tả recommendation service là Deployment độc lập trong kiến trúc GKE và luồng MLOps. Nội dung này phù hợp với trạng thái sau khôi phục nên không chỉnh sửa tệp báo cáo.
