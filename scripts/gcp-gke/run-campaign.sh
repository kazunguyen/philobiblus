#!/usr/bin/env bash
set -euo pipefail

TIERS=(110 120 125 130 140)
DURATION="8m"
THINK_TIME_SECONDS="5"

echo "Bắt đầu chiến dịch Capacity Test cho backend..."

for VU in "${TIERS[@]}"; do
    echo "======================================"
    echo "Bắt đầu Tier: $VU VUs"
    RUN_ID="tier_${VU}_$(date +%s)"

    export VUS=$VU
    export DURATION=$DURATION
    export THINK_TIME_SECONDS=$THINK_TIME_SECONDS
    export RUN_ID=$RUN_ID

    if ! bash scripts/gcp-gke/run-backend-capacity-test.sh; then
        echo "CẢNH BÁO: Test thất bại tại tier $VU VUs (Lỗi Threshold hoặc Safety Stop). Chiến dịch sẽ dừng lại."
        break
    fi

    echo "Hoàn thành tier $VU. Đang chờ HPA scale down về đúng 2 replicas..."
    while true; do
        READY_PODS=$(kubectl get deploy philobiblus-backend -n philobiblus -o jsonpath='{.status.readyReplicas}')
        if [[ "$READY_PODS" == "2" ]]; then
            break
        fi
        sleep 10
    done

    echo "HPA đã về 2. Đang chờ 5 phút cooling off cho PromQL..."
    sleep 300
done

echo "Chiến dịch Capacity Test hoàn tất!"
