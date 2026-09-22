#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

if [[ -e "$SCRIPT_DIR/../.terraform-destroy-in-progress" ]]; then
  echo "Refusing to apply while terraform-delete.sh is destroying the environment." >&2
  exit 1
fi

source "$SCRIPT_DIR/lib.sh"

require_commands terraform gcloud

PROJECT_ID="$(project_id)"
STATE_BUCKET_NAME="$(state_bucket_name)"

log "Applying foundation API changes. Cloud SQL and Cloud Run are not replaced by this step."
terraform_init "$FOUNDATION_DIR" "$STATE_BUCKET_NAME"
terraform_plan_apply "$FOUNDATION_DIR" foundation-gke.tfplan

log "Creating or updating the GKE Autopilot platform. This can take 10-20 minutes."
terraform_init "$GKE_PLATFORM_DIR" "$STATE_BUCKET_NAME"
terraform_plan_apply "$GKE_PLATFORM_DIR" gke-platform.tfplan

log "GKE platform apply completed."
terraform -chdir="$GKE_PLATFORM_DIR" output
