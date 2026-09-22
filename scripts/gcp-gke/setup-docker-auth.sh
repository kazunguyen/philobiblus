#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

TOKEN="$(cmd.exe /c gcloud auth print-access-token | tr -d '\r\n')"
echo "$TOKEN" | docker login -u oauth2accesstoken --password-stdin https://asia-southeast1-docker.pkg.dev
log "Docker authenticated with Artifact Registry."
