#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

require_commands terraform gcloud kubectl

KUBECONFIG_PATH="$LOCAL_DIR/kubeconfig"
PLUGIN_PATH="$LOCAL_DIR/tools/gke-gcloud-auth-plugin"

[[ -x "$PLUGIN_PATH" ]] || "$SCRIPT_DIR/05-install-auth-plugin.sh"

CLUSTER_NAME="$(terraform -chdir="$GKE_PLATFORM_DIR" output -raw cluster_name)"
export PATH="$LOCAL_DIR/tools:$PATH"
KUBECONFIG="$KUBECONFIG_PATH" USE_GKE_GCLOUD_AUTH_PLUGIN=True \
  gcloud container clusters get-credentials "$CLUSTER_NAME" \
    --project="$(project_id)" \
    --region="$REGION" >/dev/null
chmod 600 "$KUBECONFIG_PATH"

KUBECONFIG="$KUBECONFIG_PATH" kubectl cluster-info
KUBECONFIG="$KUBECONFIG_PATH" kubectl get nodes -o wide

log "Temporary-token kubeconfig written to ignored path $KUBECONFIG_PATH"
log "Refresh it by rerunning this script when the access token expires."
