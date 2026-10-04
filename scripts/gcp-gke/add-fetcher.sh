#!/usr/bin/env bash
cat >> infrastructure/terraform/runtime/images.auto.tfvars << 'EOF'
model_fetcher_image = "kazu912/philobiblus-model-fetcher@sha256:cc1afdbe1f4d508cebba4970d30accfe86d2bdde677b644d743688b626a1c4e2"
EOF

sed -i '/RECOMMENDATION_IMAGE=/a MODEL_FETCHER_IMAGE="$(read_tfvar_string "$RUNTIME_DIR/images.auto.tfvars" model_fetcher_image)"' scripts/gcp-gke/30-app-apply.sh
sed -i '/recommendation_image.*=/a model_fetcher_image          = "$MODEL_FETCHER_IMAGE"' scripts/gcp-gke/30-app-apply.sh
