#!/usr/bin/env bash
set -euo pipefail

VUS="${VUS:-10}"
DURATION="${DURATION:-8m}"
THINK_TIME_SECONDS="${THINK_TIME_SECONDS:-5}"
RUN_ID="${RUN_ID:-run_$(date +%s)}"
NAMESPACE="philobiblus"
CONTEXT="gke_grace-enhanced_asia-southeast1_philobiblus-dev-gke"

# 1. Validation
current_ctx=$(kubectl config current-context)
if [[ "$current_ctx" != "$CONTEXT" ]]; then
    echo "Lỗi: Sai context. Yêu cầu context phải là $CONTEXT"
    exit 1
fi

HPA_MIN=$(kubectl get hpa philobiblus-backend-hpa -n "$NAMESPACE" -o jsonpath='{.spec.minReplicas}')
HPA_MAX=$(kubectl get hpa philobiblus-backend-hpa -n "$NAMESPACE" -o jsonpath='{.spec.maxReplicas}')
if [[ "$HPA_MIN" != "2" || "$HPA_MAX" != "6" ]]; then
    echo "Lỗi: HPA phải có min 2, max 6."
    exit 1
fi

READY_PODS=$(kubectl get deploy philobiblus-backend -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}')
if [[ "$READY_PODS" != "2" ]]; then
    echo "Lỗi: Backend hiện không có đúng 2 Ready pods."
    exit 1
fi

if kubectl get job k6-load-test -n "$NAMESPACE" >/dev/null 2>&1; then
    echo "Lỗi: Đang có Job load test k6 tồn tại."
    exit 1
fi

ARTIFACT_DIR="artifacts/load-tests/$RUN_ID"
mkdir -p "$ARTIFACT_DIR"

# 2. Cleanup Trap
EVIDENCE_PID=""
cleanup() {
    echo "Đang dọn dẹp tài nguyên..."
    if [[ -n "$EVIDENCE_PID" ]]; then
        kill "$EVIDENCE_PID" 2>/dev/null || true
    fi
    kubectl delete job k6-load-test -n "$NAMESPACE" --ignore-not-found >/dev/null
    kubectl delete configmap k6-script -n "$NAMESPACE" --ignore-not-found >/dev/null
}
trap cleanup EXIT INT TERM

# 3. Chạy loop lấy evidence 10s/lần
(
    while true; do
        DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
        echo "[$DATE]" >> "$ARTIFACT_DIR/hpa.csv"
        kubectl get hpa philobiblus-backend-hpa -n "$NAMESPACE" >> "$ARTIFACT_DIR/hpa.csv" || true
        echo "[$DATE]" >> "$ARTIFACT_DIR/deployment.csv"
        kubectl get deploy philobiblus-backend -n "$NAMESPACE" >> "$ARTIFACT_DIR/deployment.csv" || true
        echo "[$DATE]" >> "$ARTIFACT_DIR/pods.csv"
        kubectl get pods -n "$NAMESPACE" -l app.kubernetes.io/name=philobiblus -o wide >> "$ARTIFACT_DIR/pods.csv" || true
        echo "[$DATE]" >> "$ARTIFACT_DIR/top-pods.csv"
        kubectl top pods -n "$NAMESPACE" >> "$ARTIFACT_DIR/top-pods.csv" 2>/dev/null || true
        sleep 10
    done
) &
EVIDENCE_PID=$!

# 4. Triển khai k6 Job hoặc Sleep nếu Baseline
if [[ "$VUS" == "0" ]]; then
    echo "Tier 0 (Baseline): Bỏ qua k6, chỉ ghi nhận thông số trong 8 phút..."
    sleep 480
    echo "Đang tạo artifact giả cho Tier 0..."
    echo "{}" > "$ARTIFACT_DIR/k6-summary.json"
    echo "{}" > "$ARTIFACT_DIR/k6-output.json"
else
    kubectl create configmap k6-script -n "$NAMESPACE" --from-file=script.js=scripts/gcp-gke/load-tests/backend-capacity.js >/dev/null

    cat <<EOF | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: k6-load-test
  namespace: $NAMESPACE
  labels:
    app.kubernetes.io/name: philobiblus
    app.kubernetes.io/component: load-test
spec:
  backoffLimit: 0
  template:
    metadata:
      labels:
        app.kubernetes.io/name: philobiblus
        app.kubernetes.io/component: load-test
    spec:
      restartPolicy: Never
      securityContext:
        runAsNonRoot: true
      containers:
      - name: k6
        image: grafana/k6:latest
        command:
        - sh
        - -c
        - |
          k6 run /test/script.js --summary-export=/tmp/k6-summary.json --out json=/tmp/k6-output.json
          K6_EXIT=\$?
          echo "==== K6_SUMMARY ===="
          cat /tmp/k6-summary.json || echo "{}"
          echo ""
          echo "==== K6_OUTPUT ===="
          cat /tmp/k6-output.json || echo ""
          echo ""
          echo "==== END_OUTPUT ===="
          exit \$K6_EXIT
        env:
        - name: VUS
          value: "$VUS"
        - name: DURATION
          value: "$DURATION"
        - name: RUN_ID
          value: "$RUN_ID"
        - name: THINK_TIME_SECONDS
          value: "$THINK_TIME_SECONDS"
        securityContext:
          allowPrivilegeEscalation: false
          capabilities:
            drop:
            - ALL
        volumeMounts:
        - name: script-volume
          mountPath: /test
      volumes:
      - name: script-volume
        configMap:
          name: k6-script
EOF

    echo "Đang chờ Job chạy..."
    while ! kubectl get pod -l job-name=k6-load-test -n "$NAMESPACE" | grep -q "k6-load-test"; do
        sleep 2
    done

    echo "Đang chờ Job hoàn tất (khoảng 8 phút)..."
    kubectl wait --for=condition=complete job/k6-load-test -n "$NAMESPACE" --timeout=600s || \
    kubectl wait --for=condition=failed job/k6-load-test -n "$NAMESPACE" --timeout=10s || true

    POD_NAME=$(kubectl get pods -l job-name=k6-load-test -n "$NAMESPACE" -o jsonpath='{.items[0].metadata.name}')

    echo "Đang lấy log k6..."
    kubectl logs "$POD_NAME" -n "$NAMESPACE" > "$ARTIFACT_DIR/k6-logs.txt" || true

    echo "Đang trích xuất file kết quả k6..."
    awk '/==== K6_SUMMARY ====/{flag=1; next} /==== K6_OUTPUT ====/{flag=0} flag' "$ARTIFACT_DIR/k6-logs.txt" > "$ARTIFACT_DIR/k6-summary.json"
    awk '/==== K6_OUTPUT ====/{flag=1; next} /==== END_OUTPUT ====/{flag=0} flag' "$ARTIFACT_DIR/k6-logs.txt" > "$ARTIFACT_DIR/k6-output.json"
fi

kubectl get events -n "$NAMESPACE" --sort-by='.metadata.creationTimestamp' > "$ARTIFACT_DIR/events.txt"

# Metadata
cat <<EOF > "$ARTIFACT_DIR/metadata.md"
# Run ID: $RUN_ID
- **VUS**: $VUS
- **Duration**: $DURATION
- **Git SHA**: $(git rev-parse HEAD 2>/dev/null || echo "unknown")
- **Start/End UTC**: Bắt đầu lúc $(date -u +"%Y-%m-%dT%H:%M:%SZ")
EOF

# Job status check (Bypass for VUS 0)
if [[ "$VUS" == "0" ]]; then
    exit 0
fi

JOB_STATUS=$(kubectl get job k6-load-test -n "$NAMESPACE" -o jsonpath='{.status.succeeded}')
if [[ "$JOB_STATUS" == "1" ]]; then
    exit 0
else
    echo "K6 Job báo lỗi (Fail threshold hoặc k6 error). Check log."
    exit 1
fi
