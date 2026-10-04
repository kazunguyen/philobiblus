#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

require_commands terraform kubectl gcloud

PROJECT_ID="$(project_id)"
STATE_BUCKET_NAME="$(state_bucket_name)"

"$SCRIPT_DIR/25-kubeconfig.sh" >/dev/null
export PATH="$LOCAL_DIR/tools:$PATH"
KUBECONFIG_FILE="$LOCAL_DIR/kubeconfig"

log "PodMonitoring resources:"
kubectl --kubeconfig="$KUBECONFIG_FILE" -n philobiblus get podmonitoring

log "Backend target label configuration:"
kubectl --kubeconfig="$KUBECONFIG_FILE" -n philobiblus get podmonitoring philobiblus-backend -o jsonpath='{.spec.targetLabels.fromPod}'
printf '\n'

terraform_init "$GKE_OBSERVABILITY_DIR" "$STATE_BUCKET_NAME"
DASHBOARD_URL="$(terraform -chdir="$GKE_OBSERVABILITY_DIR" output -raw dashboard_url)"
log "Cloud Monitoring dashboard: $DASHBOARD_URL"

log "Managed alert policies:"
gcloud monitoring policies list \
  --project="$PROJECT_ID" \
  --filter='display_name:Philobiblus' \
  --format='table(displayName,enabled,name)'

log "Metric ingestion can take a few minutes after a PodMonitoring change. Open the dashboard above to confirm data points."
