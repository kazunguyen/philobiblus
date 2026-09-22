#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

export KUBECONFIG="$LOCAL_DIR/kubeconfig"
export PATH="$LOCAL_DIR/tools:$PATH"

PROJECT_ID="$(project_id)"
log "Checking Certificate Manager API..."
cmd.exe /c gcloud services list --enabled --project="$PROJECT_ID" --filter="config.name=certificatemanager.googleapis.com" --format="value(config.name)"

log "Checking Gateway IP from gke-platform state..."
GATEWAY_IP="$(terraform -chdir="$GKE_PLATFORM_DIR" output -raw gateway_ip_address)"
log "Gateway IP: $GATEWAY_IP"

log "Checking Gateway and HTTPRoute status..."
kubectl get gateway,httproute -n philobiblus

log "Checking health endpoint on Gateway IP..."
curl --fail --silent --show-error "http://${GATEWAY_IP}/health"
echo ""

log "Pre-check passed successfully!"
