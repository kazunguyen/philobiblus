#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

"$SCRIPT_DIR/setup-docker-auth.sh"

PROJECT_ID="$(project_id)"
IMAGE_NAME="asia-southeast1-docker.pkg.dev/${PROJECT_ID}/philobiblus/https-proxy"
TAG="v1"
FULL_TAG="${IMAGE_NAME}:${TAG}"

log "Building proxy image: ${FULL_TAG}..."
docker build -t "$FULL_TAG" "$PROJECT_ROOT/proxy"

log "Pushing proxy image: ${FULL_TAG}..."
docker push "$FULL_TAG"

DIGEST="$(docker inspect --format='{{index .RepoDigests 0}}' "$FULL_TAG" 2>/dev/null || true)"
if [[ -z "$DIGEST" ]]; then
  DIGEST="$(docker image inspect "$FULL_TAG" | jq -r '.[0].RepoDigests[0]')"
fi

log "Proxy image published successfully: ${DIGEST}"
printf '%s\n' "$DIGEST" > "$LOCAL_DIR/proxy-image-digest.txt"
