#!/usr/bin/env bash
set -euo pipefail

cd /mnt/d/JUNIOR/SEMESTER2/Thuc-tap/JITS_INNO_Labs/devops-training-NguyenQuangDung/phase-2/track-mlops-security/philobiblus
export PATH=$PATH:~/.local/bin

echo "Running Python tests..."
python3 -m venv .venv-cache-pool
source .venv-cache-pool/bin/activate
python -m pip install --upgrade pip
python -m pip install -r backend/requirements.txt
PYTHONPATH=backend pytest -q backend/tests
deactivate

echo "Running Helm lint..."
helm lint kubernetes/helm/philobiblus \
  --set frontend.enabled=false \
  --set postgres.enabled=false \
  --set ingress.enabled=false \
  --set backend.service.port=8000 \
  --set backend.bindHost=0.0.0.0 \
  --set backend.allowedOrigins=https://kazunguyen.github.io \
  --set externalDatabase.enabled=true \
  --set externalDatabase.connectionName=placeholder:region:instance \
  --set gcpSecrets.enabled=true \
  --set gcpSecrets.projectId=grace-enhanced \
  --set gcpSecrets.databaseUrlSecret=database-url \
  --set gcpSecrets.jwtSecret=jwt-secret \
  --set gateway.enabled=true \
  --set gateway.addressName=placeholder-address \
  --set redis.enabled=true \
  --set monitoring.podMonitoring.enabled=true

echo "Running Terraform validation..."
terraform -chdir=infrastructure/terraform/gke-app fmt -check
terraform -chdir=infrastructure/terraform/gke-app validate

echo "Static validation and backend tests PASS."
