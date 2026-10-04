# GKE Backend Capacity Report

**Date**: 2026-09-23
**Environment**: philobiblus-dev-gke
**Git SHA**: HEAD
**Image Digest**: philobiblus-backend:latest

## Resources Configuration
- **HPA**: min 2, max 6, CPU target 50%
- **Quota**: GKE Autopilot (default limits applied dynamically)
- **Nodes**: GKE Autopilot
- **Cloud SQL**: db-f1-micro (PostgreSQL 15)

## Workload & Thresholds
- **Workload**: 70% public list, 20% catalogue search, 10% single book. 5s think time.
- **Thresholds**:
  - k6 errors < 1%
  - k6 p95 < 1s
- **Safety Stop**:
  - HPA capped at 6 pods & CPU > 70% for 60s (or Test threshold failed)

## Results Table

| Tier (VU) | RPS | p50 (ms) | p95 (k6) | Errors | 5xx | Desired/Ready | CPU Target | Verdict |
|-----------|-----|----------|----------|--------|-----|---------------|------------|---------|
| 0         | 0   | -        | -        | 0%     | 0%  | 2/2           | 2%         | PASS    |
| 10        | ~2  | -        | ~51ms    | 0%     | 0%  | 2/2           | -          | PASS    |
| 25        | 4.9 | 28.5     | 130.2 ms | 0%     | 0%  | 2/2           | -          | PASS    |
| 50        | 9.9 | 21.4     | 107.1 ms | 0.08%  | 0%  | 2/2           | -          | PASS    |
| 100       | 18.6| 24.6     | 166.0 ms | 0.51%  | <1% | 4/4           | 50%        | PASS    |
| 110       | 21.5| 26.2     | 354.0 ms | 0.68%  | <1% | 4/4           | 50%        | PASS    |
| 120       | 23.4| 26.1     | 322.5 ms | 0.94%  | <1% | 5/5           | 50%        | PASS    |
| 125       | 24.4| 20.1     | 331.4 ms | 1.48%  | >1% | 5/5           | 50%        | FAIL    |

## Conclusion

- **Operational Capacity (PASS < 6 pods)**: 120 VUs
- **Observed Maximum (PASS with 6 pods)**: 120 VUs (HPA scale down from spike, handled at 5 pods)
- **Active Users**: ~120 người dùng truy cập đồng thời (Active Users), tương đương ~23.4 RPS liên tục (Sustained).

### Recommendations
1. **Bottleneck Identification**: Điểm gãy (breaking point) của hệ thống được xác định chính xác tại mốc **125 VUs**. Mặc dù thời gian phản hồi (p95 ~ 331ms) vẫn nằm trong ngưỡng an toàn rất sâu (<1000ms) và HPA mới chỉ dùng 5/6 pods, nhưng tỉ lệ lỗi (Errors) đã vượt ngưỡng 1% (đạt 1.48%). Sự gia tăng đột ngột của các request lỗi nhưng có thời gian phản hồi nhanh (median ~20ms) chứng tỏ ứng dụng đã phản hồi lỗi ngay lập tức (Fast failure). Điều này củng cố giả thuyết rằng Database (Cloud SQL `db-f1-micro`) đã cạn kiệt Connection hoặc thắt cổ chai I/O, từ chối kết nối ngay tức thì thay vì treo máy (Timeout).
2. **Database Tuning / Connection Pooling**: Khuyến nghị cấu hình Connection Pooling (PgBouncer) hoặc tăng quy mô Cloud SQL (nâng cấp tier) nếu dự kiến lượng traffic trên production tiến gần đến mốc 120 người dùng liên tục.
3. **Caching**: Cân nhắc áp dụng Redis caching cho các API tra cứu danh sách sách (hiện đang chiếm tới 70% khối lượng truy vấn) để giảm tải đáng kể cho Database.
