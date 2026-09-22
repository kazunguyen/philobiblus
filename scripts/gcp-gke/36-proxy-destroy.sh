#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

require_commands terraform

PROXY_DIR="$PROJECT_ROOT/infrastructure/terraform/https-proxy"
STATE_BUCKET_NAME="$(state_bucket_name)"

log "Initializing https-proxy Terraform module..."
terraform_init "$PROXY_DIR" "$STATE_BUCKET_NAME"

log "Destroying https-proxy resources..."
terraform -chdir="$PROXY_DIR" destroy -auto-approve

log "HTTPS Proxy resources destroyed successfully."
