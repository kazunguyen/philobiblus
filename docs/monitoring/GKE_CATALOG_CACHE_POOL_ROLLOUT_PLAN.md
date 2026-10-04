# GKE catalogue cache and database pool rollout plan

## 1. Objective

Execute and validate the backend changes that target the current capacity boundary between 120 and 125 virtual users:

- remove the public catalogue N+1 owner lookup with SQLAlchemy eager loading;
- cache anonymous `GET /api/books/public` responses in a shared Redis instance for 30 seconds;
- invalidate all catalogue generations after changes to books, reading progress, or account deletion;
- cap each backend process at three persistent and two overflow PostgreSQL connections;
- compare the new deployment against `docs/monitoring/reports/GKE_BACKEND_CAPACITY_REPORT_2026-09-23.md`.

Do not add PgBouncer or resize Cloud SQL during this run. Those changes would introduce another independent variable and make the before/after result invalid.

## 2. Expected architecture

```text
GitHub Pages
    |
GKE Gateway / backend Service
    |
2-6 backend Pods ---- shared Redis Deployment (ephemeral catalogue cache)
    |
Cloud SQL Auth Proxy sidecar per Pod
    |
Cloud SQL PostgreSQL
```

Redis stores derived public data only. It has no persistent volume and may be restarted without losing application data. The backend falls back to PostgreSQL whenever Redis is unavailable.

At six backend Pods, the configured theoretical application connection ceiling is:

```text
6 Pods * (DATABASE_POOL_SIZE 3 + DATABASE_MAX_OVERFLOW 2) = 30 connections
```

## 3. Rules for the executing agent

1. Run every command in WSL from the Philobiblus root.
2. Record commands, timestamps, image digest, Git SHA, Kubernetes context, and raw evidence paths.
3. Never print Secret values or `DATABASE_URL`.
4. Use immutable Docker image tags and deploy by digest.
5. Stop immediately if the active kubectl context is not the expected GKE cluster.
6. Do not modify the existing capacity report. Create a new report named `docs/monitoring/reports/GKE_BACKEND_CACHE_POOL_REPORT_2026-09-24.md`.
7. If a source or configuration defect is discovered, describe it and stop before changing code. Return the finding to the primary agent.

## 4. Preflight and baseline capture

```bash
cd /mnt/d/JUNIOR/SEMESTER2/Thuc-tap/JITS_INNO_Labs/devops-training-NguyenQuangDung/phase-2/track-mlops-security/philobiblus

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
```

Save the old backend image reference because it is the rollback target:

```bash
mkdir -p artifacts/cache-pool-rollout
kubectl -n philobiblus get deploy philobiblus-backend -o yaml \
  > artifacts/cache-pool-rollout/backend-deployment-before.yaml
kubectl -n philobiblus get hpa philobiblus-backend-hpa -o yaml \
  > artifacts/cache-pool-rollout/backend-hpa-before.yaml
```

## 5. Static validation and backend tests

Create an isolated virtual environment and run the complete backend suite:

```bash
python3 -m venv .venv-cache-pool
source .venv-cache-pool/bin/activate
python -m pip install --upgrade pip
python -m pip install -r backend/requirements.txt
PYTHONPATH=backend pytest -q backend/tests
deactivate
```

Validate the chart with the same required inputs used by the deployment script:

```bash
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

terraform -chdir=infrastructure/terraform/gke-app fmt -check
terraform -chdir=infrastructure/terraform/gke-app validate
```

PASS requires all tests, Helm lint, and Terraform validation to exit with code zero.

## 6. Build and publish an immutable backend image

Use a unique tag. Do not reuse `latest`.

```bash
export IMAGE_REPOSITORY='kazu912/philobiblus-backend'
export IMAGE_TAG="cache-pool-$(date -u +%Y%m%dT%H%M%SZ)-$(git rev-parse --short HEAD)"

docker build --platform linux/amd64 \
  -f backend/Dockerfile \
  -t "$IMAGE_REPOSITORY:$IMAGE_TAG" \
  backend

docker push "$IMAGE_REPOSITORY:$IMAGE_TAG"

export BACKEND_DIGEST="$(docker buildx imagetools inspect "$IMAGE_REPOSITORY:$IMAGE_TAG" \
  --format '{{json .Manifest.Digest}}' | tr -d '"')"
test -n "$BACKEND_DIGEST"
printf 'Backend image: %s@%s\n' "$IMAGE_REPOSITORY" "$BACKEND_DIGEST"
```

Edit the ignored runtime input `infrastructure/terraform/runtime/images.auto.tfvars`. Replace only `backend_image`; retain the current recommendation and model fetcher references:

```hcl
backend_image = "kazu912/philobiblus-backend@sha256:REPLACE_WITH_NEW_DIGEST"
```

Confirm that no secret was added to Git before continuing:

```bash
git status --short
git diff --check
```

## 7. Deploy through Terraform

```bash
bash scripts/gcp-gke/30-app-apply.sh
```

The apply must create or update the following runtime objects:

- `Deployment/philobiblus-redis` with one Ready Pod;
- `Service/philobiblus-redis` on TCP 6379;
- backend Pods with `REDIS_URL` and four database pool variables;
- backend image pinned to the newly published digest.

Wait for all rollouts:

```bash
kubectl -n philobiblus rollout status deploy/philobiblus-redis --timeout=5m
kubectl -n philobiblus rollout status deploy/philobiblus-backend --timeout=10m
kubectl -n philobiblus get deploy,pods,hpa,svc
kubectl -n philobiblus get events --sort-by='.metadata.creationTimestamp' | tail -n 80
```

Inspect variable names without exposing their values:

```bash
kubectl -n philobiblus get deploy philobiblus-backend \
  -o jsonpath='{range .spec.template.spec.containers[?(@.name=="backend")].env[*]}{.name}{"\n"}{end}' \
  | sort
```

Expected names include `REDIS_URL`, `CATALOG_CACHE_TTL_SECONDS`, `DATABASE_POOL_SIZE`, `DATABASE_MAX_OVERFLOW`, `DATABASE_POOL_TIMEOUT_SECONDS`, and `DATABASE_POOL_RECYCLE_SECONDS`.

## 8. Functional cache verification

Start with an empty cache and make two identical anonymous catalogue requests from inside the cluster:

```bash
kubectl -n philobiblus exec deploy/philobiblus-redis -- redis-cli FLUSHDB

kubectl -n philobiblus run catalogue-cache-check \
  --image=curlimages/curl:8.12.1 \
  --restart=Never \
  --rm -i \
  -- curl -fsS 'http://philobiblus-backend:8000/api/books/public?limit=20' >/dev/null

kubectl -n philobiblus run catalogue-cache-check-2 \
  --image=curlimages/curl:8.12.1 \
  --restart=Never \
  --rm -i \
  -- curl -fsS 'http://philobiblus-backend:8000/api/books/public?limit=20' >/dev/null

kubectl -n philobiblus exec deploy/philobiblus-redis -- redis-cli DBSIZE
kubectl -n philobiblus exec deploy/philobiblus-redis -- \
  redis-cli GET philobiblus:catalog:version
```

`DBSIZE` must be at least one after the requests. The version key may be absent until the first mutation; that is valid because generation zero is the default.

Then perform one normal book mutation through the UI or authenticated API. Do not place a token in the report. Confirm that the version increases and that another anonymous request creates a key in the new generation.

Test graceful degradation:

```bash
kubectl -n philobiblus scale deploy/philobiblus-redis --replicas=0
kubectl -n philobiblus rollout status deploy/philobiblus-backend --timeout=30s || true
```

While Redis is down, call the anonymous catalogue endpoint. It must still return HTTP 200 through PostgreSQL, and backend logs may contain a cache warning. Restore Redis immediately:

```bash
kubectl -n philobiblus scale deploy/philobiblus-redis --replicas=1
kubectl -n philobiblus rollout status deploy/philobiblus-redis --timeout=5m
```

## 9. Controlled capacity retest

Allow five minutes after rollout before measuring. Use the same workload, eight-minute duration, five-second think time, and thresholds as the previous report. Run tiers sequentially and wait until the HPA returns to two Ready replicas between tiers.

```bash
for VUS in 0 25 50 75 100 110 120 125 150; do
  export VUS
  export DURATION='8m'
  export THINK_TIME_SECONDS='5'
  export RUN_ID="cache_pool_${VUS}_$(date -u +%Y%m%dT%H%M%SZ)"

  bash scripts/gcp-gke/run-backend-capacity-test.sh || true

  SETTLE_DEADLINE=$((SECONDS + 1200))
  while [[ "$(kubectl -n philobiblus get deploy philobiblus-backend -o jsonpath='{.status.readyReplicas}')" != '2' ]]; do
    if (( SECONDS >= SETTLE_DEADLINE )); then
      echo "Backend did not return to two Ready replicas within 20 minutes" >&2
      exit 1
    fi
    sleep 15
  done
  sleep 300
done
```

The loop uses `|| true` because k6 intentionally exits nonzero when a threshold fails. Every failed tier must still be recorded and analyzed.

For each tier, extract at least:

- achieved request rate;
- total requests;
- p50, p90, p95, and p99 latency;
- HTTP failure ratio and 5xx ratio;
- desired/current/available backend replicas over time;
- CPU and memory per backend Pod;
- time from CPU threshold breach to a new Ready replica;
- Pod restarts, OOMKilled events, failed probes, scheduling delay;
- Cloud SQL CPU, memory, disk latency/IOPS, active connections, and connection errors;
- Redis CPU, memory, restarts, and key count;
- catalogue cache hit, miss, and error rates from `catalog_cache_operations_total`.

Use this PromQL query in Cloud Monitoring Metrics Explorer to verify that repeated anonymous catalogue traffic is served from Redis:

```promql
sum by (result) (
  rate(catalog_cache_operations_total{operation="get"}[5m])
)
```

The `hit` series should dominate after warm-up. Any sustained `error` series fails cache verification even if requests successfully fall back to PostgreSQL.

Use Cloud Monitoring for the exact test windows. Export screenshots or CSV evidence into `artifacts/load-tests/<RUN_ID>/`; do not estimate missing database metrics.

## 10. Acceptance criteria

A tier passes only when all conditions hold for the complete steady-state test window:

- k6 `http_req_failed < 1%`;
- k6 `p(95) < 1 second`;
- no sustained backend 5xx spike;
- no backend or Redis restart/OOMKilled event;
- backend Ready replicas catch up to desired replicas while load is still active;
- Cloud SQL has no connection exhaustion error;
- the endpoint remains correct with cache hits and after invalidation.

Compare at least the 110, 120, and 125 VU tiers with the old report. State separately:

1. highest tested passing VU tier;
2. recommended operating capacity with at least 10% headroom;
3. observed RPS at that operating point;
4. first failing tier and the exact failed criterion;
5. whether the evidence still identifies Cloud SQL as the bottleneck.

Do not claim improvement from VU count alone. The workload mix, duration, think time, data set, and thresholds must match the earlier test.

## 11. Decision on PgBouncer or Cloud SQL resize

After the report is complete, use this decision table:

| Evidence | Next action |
|---|---|
| Active connections approach the database limit, with connection waits/errors, while CPU and disk remain healthy | Evaluate PgBouncer in transaction pooling mode |
| Cloud SQL CPU is sustained above 80% or memory pressure is visible | Benchmark the next supported Cloud SQL tier |
| Disk latency/IOPS saturate on `PD_HDD` | Benchmark `PD_SSD` before increasing GKE replicas |
| Backend CPU saturates and database/cache remain healthy | Tune HPA and backend CPU requests/limits |
| Cache hit path improves catalogue tiers and all infrastructure metrics remain healthy | Keep the current pool and Redis settings; no database upgrade yet |

Only change one of PgBouncer, database tier, disk type, HPA, or application query behavior per subsequent experiment.

## 12. Rollback

Rollback is required if the catalogue is incorrect, invalidation fails, the backend cannot tolerate Redis failure, or the new image increases latency/errors.

1. Restore the old `backend_image` digest in `infrastructure/terraform/runtime/images.auto.tfvars`.
2. Set `redis.enabled = false` in the Terraform Helm values if Redis itself caused the failure.
3. Run `bash scripts/gcp-gke/30-app-apply.sh`.
4. Wait for the backend rollout and repeat the health/catalogue smoke tests.
5. Preserve all failed rollout evidence before cleanup.

Do not use `kubectl set image` as the final rollback because Terraform would later restore its configured digest.

## 13. Required report structure

The new Markdown report must contain:

1. immutable metadata: Git SHA, image digest, GKE context/version, HPA settings, Cloud SQL version/tier/disk;
2. exact code/configuration changes under test;
3. test methodology and thresholds;
4. one table covering every tier;
5. HPA timing and Ready replica analysis;
6. Cloud SQL and Redis evidence;
7. direct comparison with the 2026-09-23 baseline;
8. bottleneck conclusion with evidence and uncertainty;
9. highest passing capacity and conservative operating capacity;
10. recommendation selected from the decision table;
11. artifact paths and any missing evidence.

The report must distinguish observed facts from hypotheses. A database bottleneck may only be confirmed when Cloud SQL or connection-pool evidence supports it.
