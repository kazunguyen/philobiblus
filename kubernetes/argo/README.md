# Argo Workflow cho vòng đời model

`retrain-workflow-template.yaml` gọi đúng `ml/src/pipeline.py` đang dùng bởi CronJob. Pipeline giữ nguyên các bước snapshot dữ liệu, validation, training, evaluation, MLflow quality gate, cập nhật manifest và rollout recommendation service.

`retrain-cron-workflow.yaml` được phát hành ở trạng thái `suspend: true`. Trước khi kích hoạt cần cài Argo Workflows, thay ba giá trị `REPLACE_WITH_*` bằng giá trị production, xác nhận Secret `philobiblus-trainer-db` và Workload Identity của `philobiblus-trainer`. Không chạy đồng thời CronJob Helm cũ và CronWorkflow này.

Canary của recommendation chưa được tự động hóa vì service hiện chỉ phát hành một ConfigMap `model-release`; candidate và stable sẽ cùng đọc một model sau lần promote. Bước tiếp theo là tách `model-release-candidate` và `model-release`, sau đó dùng Argo Rollouts phân phối 10% traffic vào candidate và đánh giá tỷ lệ 5xx/độ trễ trước khi ghi đè stable release. Không nên mô phỏng canary khi hai tập Pod đọc cùng một model.
