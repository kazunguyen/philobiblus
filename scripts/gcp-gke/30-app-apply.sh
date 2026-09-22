#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

require_commands terraform helm

PROJECT_ID="$(project_id)"
STATE_BUCKET_NAME="$(state_bucket_name)"
BACKEND_IMAGE="$(read_tfvar_string "$RUNTIME_DIR/images.auto.tfvars" backend_image)"
RECOMMENDATION_IMAGE="$(read_tfvar_string "$RUNTIME_DIR/images.auto.tfvars" recommendation_image)"
FRONTEND_ORIGIN="${FRONTEND_ORIGIN:-$(read_tfvar_list_first_string "$RUNTIME_DIR/terraform.tfvars" allowed_origins)}"
GATEWAY_HOST="${GKE_HOSTNAME:-}"
GATEWAY_HTTPS_ENABLED="${GATEWAY_HTTPS_ENABLED:-false}"
GATEWAY_CERTIFICATE_MAP_NAME="${GATEWAY_CERTIFICATE_MAP_NAME:-}"
GATEWAY_HTTP_TO_HTTPS_REDIRECT="${GATEWAY_HTTP_TO_HTTPS_REDIRECT:-false}"
INCLUDE_IMGBB_SECRET="${INCLUDE_IMGBB_SECRET:-false}"

cat >"$GKE_APP_DIR/terraform.tfvars" <<EOF
project_id                     = "$PROJECT_ID"
region                         = "$REGION"
environment                    = "$ENVIRONMENT"
state_bucket_name              = "$STATE_BUCKET_NAME"
namespace                      = "philobiblus"
backend_image                  = "$BACKEND_IMAGE"
recommendation_image           = "$RECOMMENDATION_IMAGE"
frontend_origin                = "$FRONTEND_ORIGIN"
gateway_host                   = "$GATEWAY_HOST"
gateway_https_enabled          = $GATEWAY_HTTPS_ENABLED
gateway_certificate_map_name   = "$GATEWAY_CERTIFICATE_MAP_NAME"
gateway_http_to_https_redirect = $GATEWAY_HTTP_TO_HTTPS_REDIRECT
include_imgbb_secret           = $INCLUDE_IMGBB_SECRET
EOF
chmod 600 "$GKE_APP_DIR/terraform.tfvars"

log "Rendering the GKE Helm release before Terraform apply."
helm lint "$PROJECT_ROOT/kubernetes/helm/philobiblus" \
  --set frontend.enabled=false \
  --set postgres.enabled=false \
  --set ingress.enabled=false \
  --set backend.service.port=8000 \
  --set backend.bindHost=0.0.0.0 \
  --set backend.allowedOrigins="$FRONTEND_ORIGIN" \
  --set externalDatabase.enabled=true \
  --set externalDatabase.connectionName=placeholder:region:instance \
  --set gcpSecrets.enabled=true \
  --set gcpSecrets.projectId=placeholder-project \
  --set gcpSecrets.databaseUrlSecret=database-url \
  --set gcpSecrets.jwtSecret=jwt-secret \
  --set gateway.enabled=true \
  --set gateway.addressName=placeholder-address \
  --set gateway.host="$GATEWAY_HOST" \
  --set gateway.https.enabled="$GATEWAY_HTTPS_ENABLED" \
  --set gateway.https.certificateMapName="$GATEWAY_CERTIFICATE_MAP_NAME" \
  --set gateway.httpToHttpsRedirect="$GATEWAY_HTTP_TO_HTTPS_REDIRECT" \
  --set monitoring.podMonitoring.enabled=true

terraform_init "$GKE_APP_DIR" "$STATE_BUCKET_NAME"
terraform_plan_apply "$GKE_APP_DIR" gke-app.tfplan

log "GKE application apply completed."
terraform -chdir="$GKE_APP_DIR" output
