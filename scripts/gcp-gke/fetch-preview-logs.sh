#!/usr/bin/env bash
set -euo pipefail
mkdir -p artifacts/security
POLICY_NAME="philobiblus-dev-backend-security"

echo "Reading Cloud Armor preview logs..."
gcloud logging read \
  "resource.type=\"http_load_balancer\" AND jsonPayload.previewSecurityPolicy.name=\"$POLICY_NAME\"" \
  --project=grace-enhanced \
  --freshness=1h \
  --limit=20 \
  --format=json > artifacts/security/cloud-armor-preview.json

echo "Log count: $(jq length artifacts/security/cloud-armor-preview.json)"
