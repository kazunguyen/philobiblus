#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

require_commands terraform gcloud jq kubectl helm curl

PROJECT_ID="$(project_id)"
STATE_BUCKET_NAME="$(state_bucket_name)"

log "Checking Terraform access for project $PROJECT_ID"
terraform -chdir="$FOUNDATION_DIR" state list >/dev/null
[[ -f "$RUNTIME_DIR/images.auto.tfvars" ]] || die "Missing $RUNTIME_DIR/images.auto.tfvars; build and push images first."

log "Preflight passed: project=$PROJECT_ID region=$REGION environment=$ENVIRONMENT"
