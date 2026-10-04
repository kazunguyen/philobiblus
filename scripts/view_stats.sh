for file in artifacts/load-tests/cache_pool_*/k6-summary.json; do
  echo "--- $file ---"
  jq '{
    vus: (if .metrics.vus then .metrics.vus.max else 0 end),
    reqs: .metrics.http_reqs.count,
    p50: .metrics.http_req_duration.med,
    p95: .metrics.http_req_duration["p(95)"],
    p99: .metrics.http_req_duration["p(99)"],
    fails: (if .metrics.http_req_failed then .metrics.http_req_failed.passes else 0 end),
    fail_rate: (if .metrics.http_req_failed then .metrics.http_req_failed.rate else 0 end)
  }' "$file"
done
