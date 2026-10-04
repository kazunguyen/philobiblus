#!/usr/bin/env bash
set -euo pipefail
cd /mnt/d/JUNIOR/SEMESTER2/Thuc-tap/JITS_INNO_Labs/devops-training-NguyenQuangDung/phase-2/track-mlops-security/philobiblus

export PATH=$PATH:~/.local/bin
bash scripts/gcp-gke/30-app-apply.sh

echo "Waiting for rollouts..."
kubectl -n philobiblus rollout status deploy/philobiblus-redis --timeout=5m
kubectl -n philobiblus rollout status deploy/philobiblus-backend --timeout=10m

kubectl -n philobiblus get deploy,pods,hpa,svc
kubectl -n philobiblus get events --sort-by='.metadata.creationTimestamp' | tail -n 80

echo "Checking env vars:"
kubectl -n philobiblus get deploy philobiblus-backend \
  -o jsonpath='{range .spec.template.spec.containers[?(@.name=="backend")].env[*]}{.name}{"\n"}{end}' \
  | sort
