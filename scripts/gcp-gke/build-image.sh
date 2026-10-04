#!/usr/bin/env bash
set -euo pipefail
cd /mnt/d/JUNIOR/SEMESTER2/Thuc-tap/JITS_INNO_Labs/devops-training-NguyenQuangDung/phase-2/track-mlops-security/philobiblus

export IMAGE_REPOSITORY='kazu912/philobiblus-backend'
export IMAGE_TAG="cache-pool-$(date -u +%Y%m%dT%H%M%SZ)-$(git rev-parse --short HEAD)"

echo "Building docker image $IMAGE_REPOSITORY:$IMAGE_TAG..."
docker build --platform linux/amd64 -f backend/Dockerfile -t "$IMAGE_REPOSITORY:$IMAGE_TAG" backend

echo "Pushing image..."
docker push "$IMAGE_REPOSITORY:$IMAGE_TAG"

export BACKEND_DIGEST="$(docker buildx imagetools inspect "$IMAGE_REPOSITORY:$IMAGE_TAG" --format '{{json .Manifest.Digest}}' | tr -d '"')"
test -n "$BACKEND_DIGEST"
printf 'Backend image: %s@%s\n' "$IMAGE_REPOSITORY" "$BACKEND_DIGEST"

sed -i "s|backend_image.*=.*|backend_image = \"$IMAGE_REPOSITORY@$BACKEND_DIGEST\"|g" infrastructure/terraform/runtime/images.auto.tfvars

git status --short
git diff --check

echo "Done building and patching config."
