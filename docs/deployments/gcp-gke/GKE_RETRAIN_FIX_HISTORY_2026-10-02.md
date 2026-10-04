# Lịch sử xử lý retrain Job trên GKE ngày 02 tháng 10 năm 2026

## Phạm vi

Khắc phục Job `philobiblus-retrain` trong cluster `philobiblus-dev-gke`, sau khi Cloud Console ghi nhận trạng thái `Error` cho Job `philobiblus-retrain-29848080`.

## Nguyên nhân

NetworkPolicy `philobiblus-recommendation-ingress` chỉ cho phép Pod backend trong namespace `philobiblus` truy cập recommendation service. Trainer chạy trong namespace `philobiblus-mlops`, vì vậy bước kiểm tra `/health` sau rollout bị timeout.

Lần chạy xác minh đầu tiên sau khi mở rule phát hiện thêm manifest bootstrap chưa tồn tại trên GCS. Pipeline tải xuống tệp rỗng rồi truyền vào bước validation, dẫn tới `JSONDecodeError`.

## Thay đổi triển khai

- Helm chart bổ sung rule chỉ cho Pod có nhãn `app.kubernetes.io/name=philobiblus-trainer` trong namespace `philobiblus-mlops` truy cập port 8080 của recommendation service.
- NetworkPolicy live trên cluster được cập nhật tương ứng.
- Bổ sung release manifest cho model bootstrap tại:
  `gs://grace-enhanced-philobiblus-mlops/models/tfidf-with-tags-v1-schema2-bootstrap/manifest.json`.
- Bổ sung bản ghi release tại:
  `gs://grace-enhanced-philobiblus-mlops/releases/tfidf-with-tags-v1.json`.

## Kết quả xác minh

Job `philobiblus-retrain-manual-20261002` đã tái hiện lỗi manifest và được giữ lại làm bằng chứng chẩn đoán. Sau khi bổ sung manifest, Job `philobiblus-retrain-manual-20261002-2` hoàn thành với trạng thái `Complete`, `1/1`, thời lượng khoảng 16 giây.

Log cuối của Job:

```json
{"status": "skipped", "reason": "unchanged_fresh_champion", "snapshot_id": "catalog-e485ba4d8bcefff9b09d"}
```

CronJob tiếp tục giữ lịch `0 20 * * *` và lần chạy lịch tiếp theo sẽ sử dụng manifest bootstrap hợp lệ.
