#!/usr/bin/env bash
set -euo pipefail

echo "Starting port-forward on port 18000..."
kubectl -n philobiblus port-forward svc/philobiblus-backend 18000:8000 &
PF_PID=$!

trap "kill $PF_PID 2>/dev/null || true" EXIT
sleep 3

echo -n "Internal GET /health -> "
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:18000/health

echo -n "Internal GET /metrics -> "
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:18000/metrics

echo -n "Internal GET /docs -> "
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:18000/docs

echo -n "Internal GET /openapi.json -> "
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:18000/openapi.json

echo "Sample metric from /metrics:"
curl -s http://127.0.0.1:18000/metrics | grep -E "rate_limit_operations_total|http_requests_total" | head -n 10 || true
