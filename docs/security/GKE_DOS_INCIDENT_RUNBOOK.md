# GKE DoS incident runbook

Use this runbook when the Philobiblus Gateway, backend or Cloud SQL shows sustained saturation, elevated 5xx, high p95 latency, or a sudden rise in rejected requests. Run commands from WSL at the repository root and preserve evidence before changing controls.

## 1. Identify the affected layer

Open the **Philobiblus dev GKE** Cloud Monitoring dashboard. Record the time window, backend request rate, p95 duration, 5xx ratio, backend replica count, HPA desired replicas, rate-limit decisions, Redis errors and Cloud SQL connection or CPU metrics.

Query the live Kubernetes state:

```bash
kubectl -n philobiblus get pods,hpa -o wide
kubectl -n philobiblus describe hpa philobiblus-backend-hpa
kubectl -n philobiblus get gcpbackendpolicy philobiblus-backend -o yaml
kubectl -n philobiblus logs deploy/philobiblus-backend --since=15m --prefix
```

Interpret the result before responding:

- A high request rate with Cloud Armor preview matches is an edge attack or abusive client pattern.
- A rise in `rate_limit_operations_total{result="redis_error"}` means application limits have fallen back to conservative per-Pod limits.
- HPA at its maximum with rising latency or 5xx requires traffic reduction first; scaling alone may add database pressure.
- Low CPU with high latency and Cloud SQL connection or I/O pressure indicates the database path is constrained.

## 2. Reduce harmful traffic at the edge

Cloud Armor rules are initially in preview and therefore only log matches. Promote the smallest relevant group after checking the affected path and client pattern in load-balancer logs.

```bash
export CLOUD_ARMOR_WAF_RULES_PREVIEW=true
export CLOUD_ARMOR_SENSITIVE_RATE_LIMIT_PREVIEW=false
export CLOUD_ARMOR_GENERAL_RATE_LIMIT_PREVIEW=true
bash scripts/gcp-gke/10-configure.sh
bash scripts/gcp-gke/15-platform-plan.sh
bash scripts/gcp-gke/20-platform-apply.sh
```

This enforces only login, registration, upload and recommendation limits. If the attack is broad across `/api`, set `CLOUD_ARMOR_GENERAL_RATE_LIMIT_PREVIEW=false` in a separate apply. If a WAF signature is confirmed malicious, set `CLOUD_ARMOR_WAF_RULES_PREVIEW=false` in a later separate apply. Keep prior groups in their current state; do not promote unrelated rule groups during an incident.

## 3. Stabilize backend and dependency load

Do not raise the HPA maximum while Cloud SQL is already saturated. First stop the active capacity test or abusive client, then observe five minutes of p95, 5xx and Cloud SQL connections.

If the backend limiter reports Redis errors, inspect the Redis Pod and restore it before changing the limiter:

```bash
kubectl -n philobiblus get pods -l app.kubernetes.io/component=redis
kubectl -n philobiblus logs deploy/philobiblus-redis --since=15m
kubectl -n philobiblus describe pod -l app.kubernetes.io/component=redis
```

If database pressure remains after harmful traffic is controlled, use the existing catalogue cache and connection-pool rollout plan before changing the Cloud SQL tier: `docs/monitoring/GKE_CATALOG_CACHE_POOL_ROLLOUT_PLAN.md`.

## 4. Roll back an over-broad block

If a legitimate client flow receives unexpected 403 or 429 responses, find its rule and path in Cloud Armor request logs. Return only that rule group to preview, then apply:

```bash
export CLOUD_ARMOR_WAF_RULES_PREVIEW=true
# Keep the other two environment values at their current intended state.
bash scripts/gcp-gke/10-configure.sh
bash scripts/gcp-gke/15-platform-plan.sh
bash scripts/gcp-gke/20-platform-apply.sh
```

For application-side limits, restore the previous immutable backend image digest through the normal application apply script. For NetworkPolicy breakage, temporarily set `networkPolicy.enabled=false` in `infrastructure/terraform/gke-app/main.tf`, apply the app module, and investigate the denied connection. Do not delete the cluster, Gateway address, Cloud SQL instance or Terraform state as an incident rollback.

## 5. Close the incident

Record the trigger, affected route, rate-limit/WAF rule, peak request rate, peak p95, 5xx ratio, HPA state, Cloud SQL state, mitigation time and false positives. Add a capacity test that reproduces the observed safe traffic pattern before changing permanent thresholds.
