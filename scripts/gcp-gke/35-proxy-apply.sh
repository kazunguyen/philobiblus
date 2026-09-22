#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

require_commands terraform

PROXY_DIR="$PROJECT_ROOT/infrastructure/terraform/https-proxy"
PROJECT_ID="$(project_id)"
STATE_BUCKET_NAME="$(state_bucket_name)"

DIGEST_FILE="$LOCAL_DIR/proxy-image-digest.txt"
if [[ ! -f "$DIGEST_FILE" ]]; then
  "$SCRIPT_DIR/build-push-proxy.sh"
fi
PROXY_IMAGE="$(cat "$DIGEST_FILE" | tr -d '\r\n')"

cat >"$PROXY_DIR/terraform.tfvars" <<EOF
project_id        = "$PROJECT_ID"
region            = "$REGION"
environment       = "$ENVIRONMENT"
state_bucket_name = "$STATE_BUCKET_NAME"
proxy_image       = "$PROXY_IMAGE"
EOF
chmod 600 "$PROXY_DIR/terraform.tfvars"

log "Initializing https-proxy Terraform module..."
terraform_init "$PROXY_DIR" "$STATE_BUCKET_NAME"

log "Planning and applying https-proxy..."
terraform_plan_apply "$PROXY_DIR" https-proxy.tfplan

log "HTTPS Proxy deployment completed successfully."
PROXY_URL="$(terraform -chdir="$PROXY_DIR" output -raw proxy_url)"
API_URL="$(terraform -chdir="$PROXY_DIR" output -raw api_url)"
UPSTREAM_IP="$(terraform -chdir="$PROXY_DIR" output -raw upstream_gateway_ip)"

log "Cloud Run Proxy URL : $PROXY_URL"
log "Frontend API URL    : $API_URL"
log "Upstream Gateway IP : $UPSTREAM_IP"
