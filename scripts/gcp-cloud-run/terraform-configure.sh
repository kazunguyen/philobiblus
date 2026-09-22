#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../gcp-shared/lib/deploy-common.sh"

require_commands gcloud
require_variables PROJECT_ID REGION FRONTEND_ORIGIN

if [[ ! "$FRONTEND_ORIGIN" =~ ^https?://[^/]+$ ]]; then
  echo "FRONTEND_ORIGIN must be an origin without a path, for example https://your-user.github.io." >&2
  exit 1
fi

PROJECT_NUMBER="${PROJECT_NUMBER:-$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')}"
STATE_BUCKET_NAME="${STATE_BUCKET_NAME:-${PROJECT_ID}-tfstate-${PROJECT_NUMBER}}"
DATABASE_TIER="${DATABASE_TIER:-db-f1-micro}"
ALERT_EMAIL="${ALERT_EMAIL:-$(gcloud auth list --filter='status:ACTIVE' --format='value(account)' | head -n 1)}"

[[ -n "$ALERT_EMAIL" ]] || {
  echo "Set ALERT_EMAIL before running this script." >&2
  exit 1
}

write_if_missing() {
  local file_path="$1"

  if [[ -f "$file_path" && "${FORCE_CONFIGURE:-false}" != "true" ]]; then
    echo "Keeping existing $file_path"
    return 0
  fi

  cat >"$file_path"
  echo "Wrote $file_path"
}

write_if_missing "$PROJECT_ROOT/infrastructure/terraform/bootstrap/terraform.tfvars" <<EOF
project_id        = "$PROJECT_ID"
region            = "$REGION"
state_bucket_name = "$STATE_BUCKET_NAME"
EOF

write_if_missing "$PROJECT_ROOT/infrastructure/terraform/foundation/terraform.tfvars" <<EOF
project_id    = "$PROJECT_ID"
region        = "$REGION"
environment   = "$ENVIRONMENT"
database_tier = "$DATABASE_TIER"
protect_data  = true
EOF

write_if_missing "$PROJECT_ROOT/infrastructure/terraform/runtime/terraform.tfvars" <<EOF
project_id        = "$PROJECT_ID"
region            = "$REGION"
environment       = "$ENVIRONMENT"
state_bucket_name = "$STATE_BUCKET_NAME"
allowed_origins   = ["$FRONTEND_ORIGIN"]
alert_email       = "$ALERT_EMAIL"
protect_runtime   = true
EOF
