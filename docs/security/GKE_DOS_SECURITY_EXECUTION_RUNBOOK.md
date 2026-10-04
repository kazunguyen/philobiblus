# GKE DoS security hardening execution runbook

This runbook executes `GKE_DOS_SECURITY_HARDENING_PLAN.md`. Run commands in WSL from the Philobiblus root. Do not print secrets or replace immutable image digests with tags.

## 1. Preflight

```bash
cd /mnt/d/JUNIOR/SEMESTER2/Thuc-tap/JITS_INNO_Labs/devops-training-NguyenQuangDung/phase-2/track-mlops-security/philobiblus
set -euo pipefail
test "$(kubectl config current-context)" = \
  'gke_grace-enhanced_asia-southeast1_philobiblus-dev-gke'

git status --short
git diff --check
python3 -m venv .venv-security
source .venv-security/bin/activate
python -m pip install --upgrade pip
python -m pip install -r backend/requirements.txt
PYTHONPATH=backend pytest -q backend/tests
deactivate

bash scripts/gcp-gke/10-configure.sh
bash scripts/gcp-gke/15-platform-plan.sh
```

Record the existing deployed backend digest, Gateway URL, HPA state, and Cloud SQL metrics before applying changes.

## 2. Build and publish backend

```bash
export SECURITY_IMAGE_REPOSITORY='kazu912/philobiblus-backend'
export SECURITY_IMAGE_TAG="security-$(date -u +%Y%m%dT%H%M%SZ)-$(git rev-parse --short HEAD)"

docker build --platform linux/amd64 \
  -f backend/Dockerfile \
  -t "$SECURITY_IMAGE_REPOSITORY:$SECURITY_IMAGE_TAG" \
  backend
docker push "$SECURITY_IMAGE_REPOSITORY:$SECURITY_IMAGE_TAG"

export SECURITY_BACKEND_DIGEST="$(docker buildx imagetools inspect \
  "$SECURITY_IMAGE_REPOSITORY:$SECURITY_IMAGE_TAG" \
  --format '{{json .Manifest.Digest}}' | tr -d '"')"
test -n "$SECURITY_BACKEND_DIGEST"
printf 'backend_image = "%s@%s"\n' \
  "$SECURITY_IMAGE_REPOSITORY" "$SECURITY_BACKEND_DIGEST"
```

Replace only `backend_image` in ignored `infrastructure/terraform/runtime/images.auto.tfvars`.

## 3. Deploy Cloud Armor in preview

The configure script defaults every preview variable to `true`.

```bash
bash scripts/gcp-gke/20-platform-apply.sh
POLICY_NAME="$(terraform -chdir=infrastructure/terraform/gke-platform \
  output -raw cloud_armor_security_policy_name)"
gcloud compute security-policies describe "$POLICY_NAME" \
  --project=grace-enhanced
```

## 4. Deploy application-side controls

```bash
bash scripts/gcp-gke/30-app-apply.sh
bash scripts/gcp-gke/45-observability-apply.sh
# Wait for Managed Prometheus to index rate_limit_operations_total, then add
# the two rate-limit alert policies without retrying the whole initial rollout.
bash scripts/gcp-gke/47-rate-limit-alerts-apply.sh

kubectl -n philobiblus rollout status deploy/philobiblus-backend --timeout=10m
kubectl -n philobiblus rollout status deploy/philobiblus-redis --timeout=5m
kubectl -n philobiblus get gcpbackendpolicy,networkpolicy,httproute,gateway
kubectl -n philobiblus describe gcpbackendpolicy philobiblus-backend
```

The backend policy must report `Attached=True`. A `Conflicted` status means another `GCPBackendPolicy` already targets the Service; resolve that conflict before proceeding.

## 5. Smoke test public routes and internal paths

```bash
export API_BASE_URL='https://your-api-domain'

curl -fsS "$API_BASE_URL/api/books/public?limit=1" >/dev/null
curl -sS -o /dev/null -w '%{http_code}\n' "$API_BASE_URL/metrics"
curl -sS -o /dev/null -w '%{http_code}\n' "$API_BASE_URL/docs"
curl -sS -o /dev/null -w '%{http_code}\n' "$API_BASE_URL/openapi.json"
curl -sS -o /dev/null -w '%{http_code}\n' "$API_BASE_URL/health"

kubectl -n philobiblus port-forward svc/philobiblus-backend 8000:8000
```

The `/api` call must work; all four public operational paths must return `404`. While port-forward is active, `http://127.0.0.1:8000/metrics` and `/health` must return `200`; `/docs` remains `404` in GKE. Stop port-forward with `Ctrl+C`.

## 6. Review preview evidence

After representative traffic, query Cloud Armor preview matches:

```bash
mkdir -p artifacts/security
gcloud logging read \
  "resource.type=\"http_load_balancer\" AND jsonPayload.previewSecurityPolicy.name=\"$POLICY_NAME\"" \
  --project=grace-enhanced \
  --freshness=24h \
  --limit=100 \
  --format=json > artifacts/security/cloud-armor-preview.json
```

Check `preconfiguredExprIds`, `rateLimitAction.outcome`, HTTP status and route. Do not commit this log artifact if it contains personal data. In Cloud Monitoring, confirm no unexpected `rate_limit_operations_total{result="redis_error"}`, rising p95, 5xx, HPA saturation or Cloud SQL connection pressure.

## 7. Promote one rule group per deployment

Use this exact pattern. Each configure call rewrites ignored `gke-platform/terraform.tfvars`, so export every desired value before calling it.

```bash
# Sensitive rate limits only.
export CLOUD_ARMOR_WAF_RULES_PREVIEW=true
export CLOUD_ARMOR_SENSITIVE_RATE_LIMIT_PREVIEW=false
export CLOUD_ARMOR_GENERAL_RATE_LIMIT_PREVIEW=true
bash scripts/gcp-gke/10-configure.sh
bash scripts/gcp-gke/15-platform-plan.sh
bash scripts/gcp-gke/20-platform-apply.sh

# General API rate limit only, after its preview review.
export CLOUD_ARMOR_WAF_RULES_PREVIEW=true
export CLOUD_ARMOR_SENSITIVE_RATE_LIMIT_PREVIEW=false
export CLOUD_ARMOR_GENERAL_RATE_LIMIT_PREVIEW=false
bash scripts/gcp-gke/10-configure.sh
bash scripts/gcp-gke/15-platform-plan.sh
bash scripts/gcp-gke/20-platform-apply.sh

# Stable sensitivity-1 WAF rules only, after tuning rule IDs.
export CLOUD_ARMOR_WAF_RULES_PREVIEW=false
export CLOUD_ARMOR_SENSITIVE_RATE_LIMIT_PREVIEW=false
export CLOUD_ARMOR_GENERAL_RATE_LIMIT_PREVIEW=false
bash scripts/gcp-gke/10-configure.sh
bash scripts/gcp-gke/15-platform-plan.sh
bash scripts/gcp-gke/20-platform-apply.sh
```

Never promote all three groups in one apply.

## 8. Validate NetworkPolicy

```bash
kubectl -n philobiblus get networkpolicy
kubectl -n philobiblus get pods -l app.kubernetes.io/component=backend
kubectl -n philobiblus get pods -l app.kubernetes.io/component=redis

VUS=10 DURATION=2m THINK_TIME_SECONDS=5 \
  bash scripts/gcp-gke/run-backend-capacity-test.sh
```

The labelled k6 Job is explicitly allowed by the ingress policy. Do not enable `networkPolicy.defaultDenyEgress` in this rollout; it requires the separate DNS, Workload Identity, ImgBB, model fetcher, and Cloud SQL connectivity inventory.

## 9. Rollback

Set a promoted group back to its `true` preview variable, then rerun configure, plan and platform apply. Restore the previous immutable backend image digest and run `30-app-apply.sh` to revert application behavior.

If NetworkPolicy blocks traffic, set `networkPolicy.enabled=false` in `infrastructure/terraform/gke-app/main.tf`, apply the app module, and investigate the blocked connection. Do not delete GKE, Cloud SQL, the Gateway address or Terraform state as rollback.
