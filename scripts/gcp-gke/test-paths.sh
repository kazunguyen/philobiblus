#!/usr/bin/env bash
API_BASE_URL="http://136.68.162.254"

echo -n "GET /api/books/public?limit=1 -> "
curl -s -o /dev/null -w "%{http_code}\n" "$API_BASE_URL/api/books/public?limit=1"

echo -n "GET /metrics -> "
curl -s -o /dev/null -w "%{http_code}\n" "$API_BASE_URL/metrics"

echo -n "GET /docs -> "
curl -s -o /dev/null -w "%{http_code}\n" "$API_BASE_URL/docs"

echo -n "GET /openapi.json -> "
curl -s -o /dev/null -w "%{http_code}\n" "$API_BASE_URL/openapi.json"

echo -n "GET /health -> "
curl -s -o /dev/null -w "%{http_code}\n" "$API_BASE_URL/health"

echo -n "GET / -> "
curl -s -o /dev/null -w "%{http_code}\n" "$API_BASE_URL/"
