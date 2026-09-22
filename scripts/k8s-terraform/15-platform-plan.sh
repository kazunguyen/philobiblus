#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

require_commands terraform

STATE_BUCKET_NAME="$(state_bucket_name)"

terraform_init "$GKE_PLATFORM_DIR" "$STATE_BUCKET_NAME"
terraform -chdir="$GKE_PLATFORM_DIR" fmt -check -recursive
terraform -chdir="$GKE_PLATFORM_DIR" validate
terraform -chdir="$GKE_PLATFORM_DIR" plan -input=false -out=gke-platform.tfplan
