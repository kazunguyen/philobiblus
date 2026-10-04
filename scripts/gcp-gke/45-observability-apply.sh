#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

require_commands terraform gcloud

PROJECT_ID="$(project_id)"
STATE_BUCKET_NAME="$(state_bucket_name)"
ALERT_EMAIL="${ALERT_EMAIL:-}"
ENABLE_RATE_LIMIT_ALERTS="${ENABLE_RATE_LIMIT_ALERTS:-}"

if [[ -z "$ALERT_EMAIL" && -f "$RUNTIME_DIR/terraform.tfvars" ]]; then
  ALERT_EMAIL="$(read_tfvar_string "$RUNTIME_DIR/terraform.tfvars" alert_email)"
fi
[[ -n "$ALERT_EMAIL" ]] || die "Set ALERT_EMAIL or add alert_email to $RUNTIME_DIR/terraform.tfvars."

# Preserve the successful opt-in on later normal deploys. A first deployment
# starts with these alerts disabled because Managed Prometheus may not have
# indexed the new metric yet.
if [[ -z "$ENABLE_RATE_LIMIT_ALERTS" && -f "$GKE_OBSERVABILITY_DIR/terraform.tfvars" ]]; then
  ENABLE_RATE_LIMIT_ALERTS="$(sed -nE 's/^[[:space:]]*enable_rate_limit_alerts[[:space:]]*=[[:space:]]*(true|false)[[:space:]]*$/\1/p' "$GKE_OBSERVABILITY_DIR/terraform.tfvars" | head -n 1)"
fi
ENABLE_RATE_LIMIT_ALERTS="${ENABLE_RATE_LIMIT_ALERTS:-false}"
case "$ENABLE_RATE_LIMIT_ALERTS" in
  true|false) ;;
  *) die "ENABLE_RATE_LIMIT_ALERTS must be true or false." ;;
esac

terraform_init "$GKE_PLATFORM_DIR" "$STATE_BUCKET_NAME"
CLUSTER_NAME="$(terraform -chdir="$GKE_PLATFORM_DIR" output -raw cluster_name)"

cat >"$GKE_OBSERVABILITY_DIR/terraform.tfvars" <<EOF
project_id        = "$PROJECT_ID"
region            = "$REGION"
environment       = "$ENVIRONMENT"
state_bucket_name = "$STATE_BUCKET_NAME"
cluster_name      = "$CLUSTER_NAME"
namespace         = "philobiblus"
alert_email       = "$ALERT_EMAIL"
enable_alerting   = true
enable_rate_limit_alerts = $ENABLE_RATE_LIMIT_ALERTS
EOF
chmod 600 "$GKE_OBSERVABILITY_DIR/terraform.tfvars"
terraform fmt "$GKE_OBSERVABILITY_DIR/terraform.tfvars" >/dev/null

terraform_init "$GKE_OBSERVABILITY_DIR" "$STATE_BUCKET_NAME"
terraform_plan_apply "$GKE_OBSERVABILITY_DIR" gke-observability.tfplan

log "GKE observability apply completed (rate-limit alerts enabled: $ENABLE_RATE_LIMIT_ALERTS)."
terraform -chdir="$GKE_OBSERVABILITY_DIR" output
