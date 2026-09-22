#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/deploy-common.sh"

require_commands gcloud terraform docker
require_variables PROJECT_ID REGION

ACTIVE_ACCOUNT="$(gcloud auth list --filter='status:ACTIVE' --format='value(account)' | head -n 1)"
if [[ -z "$ACTIVE_ACCOUNT" ]]; then
  gcloud auth login
fi

if ! gcloud auth application-default print-access-token >/dev/null 2>&1; then
  gcloud auth application-default login
fi

gcloud config set project "$PROJECT_ID"
gcloud config set run/region "$REGION"

BILLING_ENABLED="$(gcloud billing projects describe "$PROJECT_ID" --format='value(billingEnabled)' | tr '[:upper:]' '[:lower:]')"
if [[ "$BILLING_ENABLED" != "true" ]]; then
  echo "Billing must be enabled for project $PROJECT_ID." >&2
  exit 1
fi

gcloud services enable \
  serviceusage.googleapis.com \
  cloudresourcemanager.googleapis.com \
  storage.googleapis.com
