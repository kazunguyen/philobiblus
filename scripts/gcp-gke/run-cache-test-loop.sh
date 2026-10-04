#!/usr/bin/env bash
set -Eeuo pipefail

for VUS in 0 25 50 75 100 110 120 125 130 140 150; do
  export VUS
  export DURATION='8m'
  export THINK_TIME_SECONDS='5'
  export RUN_ID="cache_pool_${VUS}_$(date -u +%Y%m%dT%H%M%SZ)"

  echo "Starting tier $VUS VUs at $(date)"
  bash scripts/gcp-gke/run-backend-capacity-test.sh || true

  echo "Waiting for HPA to scale down to 2 replicas..."
  SETTLE_DEADLINE=$((SECONDS + 1200))
  while [[ "$(kubectl -n philobiblus get deploy philobiblus-backend -o jsonpath='{.status.readyReplicas}')" != '2' ]]; do
    if (( SECONDS >= SETTLE_DEADLINE )); then
      echo "Backend did not return to two Ready replicas within 20 minutes" >&2
      exit 1
    fi
    sleep 15
  done
  echo "Sleeping 5 minutes for steady state..."
  sleep 300
done
echo "All tiers completed at $(date)"
