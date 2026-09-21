#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/deploy-common.sh"

require_commands terraform gcloud curl

RUNTIME_DIR="$(runtime_dir)"
runtime_init

SEED_JOB="$(terraform -chdir="$RUNTIME_DIR" output -raw seed_job_name)"
BACKEND_URL="$(terraform -chdir="$RUNTIME_DIR" output -raw backend_url)"

gcloud run jobs execute "$SEED_JOB" --project="$PROJECT_ID" --region="$REGION" --wait
gcloud run jobs logs read "$SEED_JOB" --project="$PROJECT_ID" --region="$REGION" --limit=200
curl --fail-with-body "$BACKEND_URL/health"
curl --fail-with-body "$BACKEND_URL/"
curl --fail-with-body "$BACKEND_URL/docs"
