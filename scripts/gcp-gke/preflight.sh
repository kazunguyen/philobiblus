#!/usr/bin/env bash
set -euo pipefail
EXPECTED_CONTEXT='gke_grace-enhanced_asia-southeast1_philobiblus-dev-gke'
test "$(kubectl config current-context)" = "$EXPECTED_CONTEXT"
git status --short
git rev-parse HEAD
kubectl -n philobiblus get deploy,pods,hpa,svc
kubectl -n philobiblus get deploy philobiblus-backend \
  -o jsonpath='{.spec.template.spec.containers[?(@.name=="backend")].image}{"\n"}'
gcloud sql instances describe philobiblus-dev-postgres \
  --project=grace-enhanced \
  --format='yaml(name,state,databaseVersion,settings.tier,settings.dataDiskType,settings.dataDiskSizeGb)'

mkdir -p artifacts/cache-pool-rollout
kubectl -n philobiblus get deploy philobiblus-backend -o yaml \
  > artifacts/cache-pool-rollout/backend-deployment-before.yaml
kubectl -n philobiblus get hpa philobiblus-backend-hpa -o yaml \
  > artifacts/cache-pool-rollout/backend-hpa-before.yaml
