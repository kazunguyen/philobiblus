#!/usr/bin/env bash
echo "Waiting for pods to scale down to 2..."
while true; do
  READY=$(kubectl get deploy philobiblus-backend -n philobiblus -o jsonpath='{.status.readyReplicas}')
  if [[ "$READY" == "2" ]]; then
    break
  fi
  sleep 10
done
echo "Ready! Starting campaign."
bash scripts/gcp-gke/run-campaign.sh
