#!/usr/bin/env bash
set -euo pipefail
cd /mnt/d/JUNIOR/SEMESTER2/Thuc-tap/JITS_INNO_Labs/devops-training-NguyenQuangDung/phase-2/track-mlops-security/philobiblus

export SECURITY_IMAGE_REPOSITORY='kazu912/philobiblus-backend'
export SECURITY_IMAGE_TAG="security-$(date -u +%Y%m%dT%H%M%SZ)-$(git rev-parse --short HEAD)"

echo "Building docker image $SECURITY_IMAGE_REPOSITORY:$SECURITY_IMAGE_TAG..."
docker build --platform linux/amd64 \
  -f backend/Dockerfile \
  -t "$SECURITY_IMAGE_REPOSITORY:$SECURITY_IMAGE_TAG" \
  backend

echo "Pushing image..."
docker push "$SECURITY_IMAGE_REPOSITORY:$SECURITY_IMAGE_TAG"

export SECURITY_BACKEND_DIGEST="$(docker buildx imagetools inspect \
  "$SECURITY_IMAGE_REPOSITORY:$SECURITY_IMAGE_TAG" \
  --format '{{json .Manifest.Digest}}' | tr -d '"')"
test -n "$SECURITY_BACKEND_DIGEST"

printf 'backend_image = "%s@%s"\n' \
  "$SECURITY_IMAGE_REPOSITORY" "$SECURITY_BACKEND_DIGEST"

sed -i "s|backend_image.*=.*|backend_image = \"$SECURITY_IMAGE_REPOSITORY@$SECURITY_BACKEND_DIGEST\"|g" infrastructure/terraform/runtime/images.auto.tfvars

echo "Updated infrastructure/terraform/runtime/images.auto.tfvars with new backend_image."
