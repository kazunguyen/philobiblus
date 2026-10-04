#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

require_commands terraform gcloud

PROJECT_ID="$(project_id)"
STATE_BUCKET_NAME="$(state_bucket_name)"
CONFIRMATION="DESTROY GKE $PROJECT_ID"

printf 'Type %s to destroy the GKE application, proxy, observability, and cluster: ' "$CONFIRMATION"
IFS= read -r ANSWER
ANSWER="${ANSWER//$'\r'/}"
[[ "$ANSWER" == "$CONFIRMATION" ]] || die "Deletion cancelled."

destroy_module() {
  local name="$1"
  local directory="$2"
  local plan_file="$LOCAL_DIR/${name}-destroy.tfplan"
  local -a destroy_args=(-destroy -input=false -out="$plan_file")

  [[ -d "$directory" ]] || { log "Skipping $name: module directory is absent."; return; }

  log "Initializing $name state."
  terraform_init "$directory" "$STATE_BUCKET_NAME"

  if ! terraform -chdir="$directory" state list | grep -q .; then
    log "Skipping $name: no managed resources remain in state."
    return
  fi

  if [[ "$name" == "gke-platform" ]]; then
    destroy_args+=(-var='protect_cluster=false')
  fi

  log "Destroying $name resources."
  terraform -chdir="$directory" plan "${destroy_args[@]}"
  terraform -chdir="$directory" apply -input=false "$plan_file"
}

# Remove dependants before deleting the GKE control plane and its networking.
destroy_module "gke-observability" "$GKE_OBSERVABILITY_DIR"
destroy_module "https-proxy" "$PROJECT_ROOT/infrastructure/terraform/https-proxy"
destroy_module "gke-app" "$GKE_APP_DIR"
destroy_module "gke-platform" "$GKE_PLATFORM_DIR"

log "GKE deployment stack destroyed. Cloud Run runtime, foundation, bootstrap state, and image registries were not changed."
