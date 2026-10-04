# GKE Backend Capacity Report

**Date**: YYYY-MM-DD
**Environment**: philobiblus-dev-gke
**Git SHA**: [SHA]
**Image Digest**: [Digest]

## Resources Configuration
- **HPA**: min 2, max 6, CPU target 70%
- **Quota**: [Limit]
- **Nodes**: [Node count & types]
- **Cloud SQL**: [Tier]

## Workload & Thresholds
- **Workload**: 70% public list, 20% catalogue search, 10% single book. 5s think time.
- **Thresholds**:
  - k6 errors < 1%
  - k6 p95 < 1s
- **Safety Stop**:
  - Dashboard p95 >= 5s
  - 5xx ratio >= 5%
  - Pod restarts
  - HPA capped at 6 pods & CPU > 70% for 60s

## Results Table

| Tier (VU) | RPS | p50 (ms) | p95 (k6) | p99 (k6) | Errors | Dash p95 | 5xx | Desired/Ready | CPU | Restarts | Verdict |
|-----------|-----|----------|----------|----------|--------|----------|-----|---------------|-----|----------|---------|
| 0         |     |          |          |          |        |          |     |               |     |          | PASS    |
| 10        |     |          |          |          |        |          |     |               |     |          |         |
| 25        |     |          |          |          |        |          |     |               |     |          |         |
| 50        |     |          |          |          |        |          |     |               |     |          |         |

## Conclusion

- **Operational Capacity (PASS < 6 pods)**: [Max VUs]
- **Observed Maximum (PASS with 6 pods)**: [Max VUs]
- **Active Users**: [sustainable active users]

### Recommendations
1.
2.
