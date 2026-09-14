# Philobiblus monitoring alert runbooks

## Scope and first response

The alert rules in the Helm chart monitor backend availability, backend error
rate and latency, backend restarts, and PostgreSQL persistent storage. Start
every investigation by recording the alert name, time window and current
dashboard values. Avoid deleting pods, PVCs or data while triaging.

```bash
kubectl get pods -n philobiblus
kubectl get deployment,hpa -n philobiblus
kubectl get events -n philobiblus --sort-by=.lastTimestamp
```

## Backend targets below minimum

**Symptom:** `PhilobiblusBackendTargetsBelowMinimum` is firing. Prometheus sees
fewer healthy backend targets than the HPA minimum.

**Checks:**

```bash
kubectl get deployment philobiblus-backend -n philobiblus
kubectl get pods -n philobiblus -l app.kubernetes.io/component=backend -o wide
kubectl get endpointslice -n philobiblus \
  -l kubernetes.io/service-name=philobiblus-backend
kubectl get servicemonitor philobiblus-backend -n philobiblus
```

**Recovery:** inspect Pending, CrashLoopBackOff and probe failures with
`kubectl describe pod`; then correct image, configuration, resource or node
capacity problems. Confirm `READY 3/3` and that the Prometheus target returns
to `UP` before resolving the incident.

## Backend 5xx ratio high

**Symptom:** `PhilobiblusBackendHigh5xxRatio` is firing because more than 5% of
requests have returned 5xx for five minutes.

**Checks:**

```bash
kubectl logs -n philobiblus deployment/philobiblus-backend --since=15m
kubectl get hpa philobiblus-backend-hpa -n philobiblus
kubectl get pods -n philobiblus -l app.kubernetes.io/component=backend
```

**Recovery:** correlate failing handlers with backend logs, database
connectivity and the dashboard latency panel. Roll back the most recent
application release if a regression is confirmed; do not suppress the alert
before the error ratio remains below 5%.

## Backend p95 latency high

**Symptom:** `PhilobiblusBackendHighP95Latency` is firing because p95 request
duration has exceeded one second for five minutes.

**Checks:**

```bash
kubectl top pods -n philobiblus
kubectl get hpa philobiblus-backend-hpa -n philobiblus
kubectl logs -n philobiblus deployment/philobiblus-backend --since=15m
kubectl exec -n philobiblus deployment/philobiblus-postgres \
  -- sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

**Recovery:** determine whether the bottleneck is CPU, backend code or
PostgreSQL. Allow HPA to scale when CPU is above its target; otherwise reduce
slow database queries or roll back the regressing release.

## Backend restarts detected

**Symptom:** `PhilobiblusBackendRestartsDetected` is firing after one or more
backend container restarts within ten minutes.

**Checks:**

```bash
kubectl get pods -n philobiblus -l app.kubernetes.io/component=backend
kubectl describe pod -n philobiblus <backend-pod-name>
kubectl logs -n philobiblus <backend-pod-name> -c backend --previous
```

**Recovery:** distinguish an intentional controlled restart from OOMKilled,
probe failure or application error. Correct the underlying cause, then verify
the Deployment returns to its desired available replica count.

## PostgreSQL PVC usage high

**Symptom:** `PhilobiblusPostgresPVCUsageHigh` is firing after PostgreSQL PVC
usage remains above 80% for ten minutes.

**Checks:**

```bash
kubectl get pvc philobiblus-postgres -n philobiblus
kubectl exec -n philobiblus deployment/philobiblus-postgres \
  -- sh -c 'df -h /var/lib/postgresql/data'
```

**Recovery:** create a database backup, identify growth sources and expand the
PVC through the storage class only after confirming volume expansion support.
Never delete the PVC or database pod as a capacity-remediation shortcut.
