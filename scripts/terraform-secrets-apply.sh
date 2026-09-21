#!/usr/bin/env bash
set -Eeuo pipefail

# Initializes the application database credential and secret values after the
# Terraform foundation module has successfully created Cloud SQL and secrets.
# Do not add secret values to terraform.tfvars or commit them to Git.

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
FOUNDATION_DIR="$PROJECT_ROOT/infrastructure/terraform/foundation"

PROJECT_ID="${PROJECT_ID:-}"
DB_NAME="${DB_NAME:-philobiblus}"
DB_USER="${DB_USER:-philobiblus_app}"

MODE="${1:-all}"
case "$MODE" in
  all|--imgbb-only) ;;
  *)
    echo "Usage: bash scripts/terraform-secrets-apply.sh [--imgbb-only]" >&2
    exit 2
    ;;
esac

for command in terraform gcloud openssl; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "Missing required command: $command" >&2
    exit 1
  }
done

[[ -f "$FOUNDATION_DIR/main.tf" ]] || {
  echo "Foundation Terraform module not found: $FOUNDATION_DIR" >&2
  exit 1
}
[[ -n "$PROJECT_ID" ]] || {
  echo "Set PROJECT_ID; see scripts/deploy-gcp.env.example." >&2
  exit 1
}


gcloud auth application-default print-access-token >/dev/null || {
  echo "Application Default Credentials are unavailable. Run: gcloud auth application-default login" >&2
  exit 1
}

terraform -chdir="$FOUNDATION_DIR" init -input=false >/dev/null

IMGBB_SECRET="$(terraform -chdir="$FOUNDATION_DIR" output -raw imgbb_api_secret_id)"

if [[ "$MODE" == "--imgbb-only" ]]; then
  gcloud secrets describe "$IMGBB_SECRET" --project="$PROJECT_ID" >/dev/null

  if [[ -z "${IMGBB_API_KEY:-}" ]]; then
    read -rsp "Enter ImgBB API key: " IMGBB_API_KEY
    echo
  fi

  [[ -n "$IMGBB_API_KEY" ]] || {
    echo "ImgBB API key cannot be empty." >&2
    exit 1
  }

  printf '%s' "$IMGBB_API_KEY" | gcloud secrets versions add "$IMGBB_SECRET" \
    --project="$PROJECT_ID" \
    --data-file=- >/dev/null

  unset IMGBB_API_KEY
  echo "Created a new ImgBB API key secret version."
  gcloud secrets versions list "$IMGBB_SECRET" --project="$PROJECT_ID"
  exit 0
fi

SQL_INSTANCE="$(terraform -chdir="$FOUNDATION_DIR" output -raw sql_instance_name)"
SQL_CONNECTION="$(terraform -chdir="$FOUNDATION_DIR" output -raw sql_connection_name)"
DB_SECRET="$(terraform -chdir="$FOUNDATION_DIR" output -raw database_url_secret_id)"
JWT_SECRET="$(terraform -chdir="$FOUNDATION_DIR" output -raw jwt_secret_id)"

for secret in "$DB_SECRET" "$JWT_SECRET" "$IMGBB_SECRET"; do
  gcloud secrets describe "$secret" --project="$PROJECT_ID" >/dev/null
done

if gcloud sql users list --instance="$SQL_INSTANCE" --project="$PROJECT_ID" \
  --format='value(name)' | grep -Fxq "$DB_USER"; then
  if [[ "${ROTATE_DB_PASSWORD:-false}" != "true" ]]; then
    cat >&2 <<EOF
Database user "$DB_USER" already exists. This script will not silently rotate
its password. The existing secret is still valid unless you changed the
database password separately.

To intentionally rotate the database credential and create new secret
versions, rerun with: ROTATE_DB_PASSWORD=true bash scripts/terraform-secrets-apply.sh
EOF
    exit 1
  fi

  DB_PASSWORD="$(openssl rand -hex 32)"
  gcloud sql users set-password "$DB_USER" \
    --instance="$SQL_INSTANCE" \
    --project="$PROJECT_ID" \
    --password="$DB_PASSWORD"
else
  DB_PASSWORD="$(openssl rand -hex 32)"
  gcloud sql users create "$DB_USER" \
    --instance="$SQL_INSTANCE" \
    --project="$PROJECT_ID" \
    --password="$DB_PASSWORD"
fi

if [[ -z "${IMGBB_API_KEY:-}" ]]; then
  read -rsp "Enter ImgBB API key: " IMGBB_API_KEY
  echo
fi

[[ -n "$IMGBB_API_KEY" ]] || {
  echo "ImgBB API key cannot be empty." >&2
  exit 1
}

DATABASE_URL="postgresql+psycopg2://${DB_USER}:${DB_PASSWORD}@/${DB_NAME}?host=/cloudsql/${SQL_CONNECTION}"
JWT_VALUE="$(openssl rand -hex 64)"

printf '%s' "$DATABASE_URL" | gcloud secrets versions add "$DB_SECRET" \
  --project="$PROJECT_ID" \
  --data-file=- >/dev/null

printf '%s' "$JWT_VALUE" | gcloud secrets versions add "$JWT_SECRET" \
  --project="$PROJECT_ID" \
  --data-file=- >/dev/null

printf '%s' "$IMGBB_API_KEY" | gcloud secrets versions add "$IMGBB_SECRET" \
  --project="$PROJECT_ID" \
  --data-file=- >/dev/null

unset DB_PASSWORD DATABASE_URL JWT_VALUE IMGBB_API_KEY

echo "Created new Secret Manager versions for database URL, JWT key, and ImgBB API key."
gcloud secrets versions list "$DB_SECRET" --project="$PROJECT_ID"
gcloud secrets versions list "$JWT_SECRET" --project="$PROJECT_ID"
gcloud secrets versions list "$IMGBB_SECRET" --project="$PROJECT_ID"
