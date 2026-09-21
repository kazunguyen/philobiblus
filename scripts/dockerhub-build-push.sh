#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/deploy-common.sh"

require_commands docker git
require_variables DOCKERHUB_USERNAME

IMAGE_TAG="${IMAGE_TAG:-$(git -C "$PROJECT_ROOT" rev-parse --short=12 HEAD)}"
BACKEND_IMAGE="$DOCKERHUB_USERNAME/philobiblus-backend:$IMAGE_TAG"
RECOMMENDATION_IMAGE="$DOCKERHUB_USERNAME/philobiblus-recommendation:$IMAGE_TAG"
RUNTIME_IMAGES_FILE="$PROJECT_ROOT/infrastructure/terraform/runtime/images.auto.tfvars"

[[ -f "$PROJECT_ROOT/ml/models/tfidf_recommender.joblib" ]] || {
  echo "Missing ml/models/tfidf_recommender.joblib." >&2
  exit 1
}

if [[ -n "${DOCKERHUB_TOKEN:-}" ]]; then
  printf '%s' "$DOCKERHUB_TOKEN" | docker login --username "$DOCKERHUB_USERNAME" --password-stdin
else
  docker login
fi

docker build \
  --platform linux/amd64 \
  -f "$PROJECT_ROOT/backend/Dockerfile" \
  -t "$BACKEND_IMAGE" \
  "$PROJECT_ROOT/backend"

docker build \
  --platform linux/amd64 \
  -f "$PROJECT_ROOT/ml/recommendation-service/Dockerfile" \
  -t "$RECOMMENDATION_IMAGE" \
  "$PROJECT_ROOT"

docker push "$BACKEND_IMAGE"
docker push "$RECOMMENDATION_IMAGE"

BACKEND_DIGEST="$(docker image inspect --format='{{index .RepoDigests 0}}' "$BACKEND_IMAGE")"
RECOMMENDATION_DIGEST="$(docker image inspect --format='{{index .RepoDigests 0}}' "$RECOMMENDATION_IMAGE")"

cat >"$RUNTIME_IMAGES_FILE" <<EOF
backend_image        = "$BACKEND_DIGEST"
recommendation_image = "$RECOMMENDATION_DIGEST"
EOF

echo "Wrote immutable image references to $RUNTIME_IMAGES_FILE"
