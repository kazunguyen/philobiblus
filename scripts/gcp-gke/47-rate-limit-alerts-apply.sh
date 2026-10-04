#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

require_commands curl gcloud

PROJECT_ID="$(project_id)"
WAIT_SECONDS="${METRIC_DESCRIPTOR_WAIT_SECONDS:-900}"
SLEEP_SECONDS="${METRIC_DESCRIPTOR_POLL_SECONDS:-30}"
METRIC_DESCRIPTOR_PATH="prometheus.googleapis.com%2Frate_limit_operations_total%2Fcounter"
METRIC_DESCRIPTOR_URL="https://monitoring.googleapis.com/v3/projects/$PROJECT_ID/metricDescriptors/$METRIC_DESCRIPTOR_PATH"

[[ "$WAIT_SECONDS" =~ ^[1-9][0-9]*$ ]] || die "METRIC_DESCRIPTOR_WAIT_SECONDS must be a positive integer."
[[ "$SLEEP_SECONDS" =~ ^[1-9][0-9]*$ ]] || die "METRIC_DESCRIPTOR_POLL_SECONDS must be a positive integer."

deadline=$((SECONDS + WAIT_SECONDS))
while (( SECONDS < deadline )); do
  ACCESS_TOKEN="$(gcloud auth print-access-token)"
  if curl -fsS --max-time 10 \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    "$METRIC_DESCRIPTOR_URL" >/dev/null; then
    unset ACCESS_TOKEN
    log "Managed Prometheus has indexed rate_limit_operations_total."
    ENABLE_RATE_LIMIT_ALERTS=true "$SCRIPT_DIR/45-observability-apply.sh"
    exit 0
  fi
  unset ACCESS_TOKEN
  log "Waiting for Managed Prometheus to index rate_limit_operations_total."
  sleep "$SLEEP_SECONDS"
done

die "Metric descriptor was not available after ${WAIT_SECONDS}s. Generate normal rate-limited API traffic, then retry."
