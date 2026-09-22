#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/deploy-common.sh"

require_commands terraform gh

RUNTIME_DIR="$(runtime_dir)"
runtime_init
BACKEND_URL="$(terraform -chdir="$RUNTIME_DIR" output -raw backend_url)"

if ! gh auth status --hostname github.com >/dev/null 2>&1; then
  gh auth login --hostname github.com --web
fi

cd "$PROJECT_ROOT"
gh variable set VITE_API_URL --body "$BACKEND_URL/api"
gh workflow run deploy-pages.yaml --ref "$FRONTEND_REF"
