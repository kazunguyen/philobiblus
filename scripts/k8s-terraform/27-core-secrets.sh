#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

PROJECT_ID="$(project_id)"
DB_SECRET="$(terraform -chdir="$FOUNDATION_DIR" output -raw database_url_secret_id)"
JWT_SECRET="$(terraform -chdir="$FOUNDATION_DIR" output -raw jwt_secret_id)"

DB_VERSION="$(gcloud secrets versions list "$DB_SECRET" --project="$PROJECT_ID" --filter='state=ENABLED' --format='value(name)' --limit=1 2>/dev/null || true)"
JWT_VERSION="$(gcloud secrets versions list "$JWT_SECRET" --project="$PROJECT_ID" --filter='state=ENABLED' --format='value(name)' --limit=1 2>/dev/null || true)"

if [[ -n "$DB_VERSION" && -n "$JWT_VERSION" ]]; then
  log "Core Secret Manager versions already exist; leaving database credentials unchanged."
  exit 0
fi

[[ -z "$DB_VERSION" && -z "$JWT_VERSION" ]] || die "Only one core secret has a version. Repair the inconsistent secret state manually before continuing."

log "Creating a Cloud SQL application user and new database/JWT secret versions."
PROJECT_ID="$PROJECT_ID" bash "$PROJECT_ROOT/scripts/terraform-secrets-apply.sh" --core-only
