# GKE Backend Capacity Test Plan

## Goal

Measure backend capacity on philobiblus-dev-gke with a repeatable workload. Report
must state VU, RPS, request mix and think time. Report two values: operational
capacity is the highest PASS tier below HPA max six Pods; observed maximum is
the highest PASS tier even if all six Pods are required.

Do not use stress-backend-hpa.sh for capacity numbers. Its continuous wget loop
is only an HPA demonstration.

## Before every tier

Save context, HPA, deployment, quota and backend pod output. Run only when:
context is gke_grace-enhanced_asia-southeast1_philobiblus-dev-gke; HPA is min
two, max six, CPU target fifty percent, ScalingActive true; backend is two of
two Ready. Do not change HPA, quota, images, database, Helm release or replicas
during this campaign.

## Agent implementation

Create scripts/gcp-gke/load-tests/backend-capacity.js and
scripts/gcp-gke/run-backend-capacity-test.sh. The shell script creates a
temporary ConfigMap and grafana/k6 Job in namespace philobiblus, streams logs,
writes k6-summary.json and k6-output.json into artifacts/load-tests/RUN_ID, and
uses a trap to remove both objects on exit, timeout or Ctrl+C.

The command interface is:
VUS=50 DURATION=8m THINK_TIME_SECONDS=5 bash scripts/gcp-gke/run-backend-capacity-test.sh

Refuse a wrong context, inactive HPA, backend not exactly two Ready or an
existing load Job. Use the internal URL http://philobiblus-backend:8000. Job
security must use runAsNonRoot true, allowPrivilegeEscalation false and drop ALL
capabilities. Do not modify HPA policy.

## k6 workload

Inspect frontend Network first. If unchanged, use seventy percent GET
/api/books/public?limit=20, twenty percent catalogue search limit twenty, and
ten percent GET one verified public book. Do not use limit one hundred as the
normal workload because it is a worst case stress request.

Each VU chooses by this mix and then sleeps five seconds. One VU therefore means
one active user performing one catalogue request every five seconds. Tag every
request with tier, run_id and scenario. Use constant-vus. Thresholds are error
rate below one percent and request duration p95 below one second.

## Tiers

Run each independently for eight minutes: baseline zero VU, then 10, 25, 50,
100, 150, 200, 300 and 400 VU. Run 400 only if 300 passes. After each tier,
delete the Job, wait until HPA and deployment return to exactly two Ready Pods,
then wait five more minutes so dashboard rate five minute windows do not include
the prior tier. Stop at the first failure. If 400 passes, use increments of 100
VU until failure or no remaining headroom.

Emergency stop and mark FAIL safety stop when any condition lasts sixty seconds:
k6 errors at least five percent, k6 p95 at least three seconds, dashboard p95
at least five seconds, dashboard 5xx ratio at least five percent, any Pod
restart or CrashLoop, ready replicas below desired for sixty seconds, or HPA at
six while CPU remains above seventy percent.

## Evidence

For every tier create:
artifacts/load-tests/RUN_ID/metadata.md, k6-summary.json, k6-output.json,
hpa.csv, deployment.csv, pods.csv, top-pods.csv, events.txt and dashboard.md.
Metadata has git SHA, image digest, HPA spec and UTC start/end.

Every ten seconds record HPA current desired CPU target; deployment desired
ready available updated; pod readiness restarts nodes; and kubectl top pods.
After each tier save HPA describe, sorted events and backend logs for fifteen
minutes.

Record max and final RPS, 5xx ratio and p95 from the existing dashboard queries.
K6 is the source of workload latency and error data. PromQL independently
confirms observability.

## PASS and conclusion

PASS requires error below one percent, p95 below one second in both k6 and
PromQL after the full five minute window, no restart, no long probe scheduling
or quota failure, HPA AbleToScale and ScalingActive true, and every requested
replica Ready within sixty seconds. DEGRADED is below safety stop but fails a
PASS condition. FAIL is a k6 failure, safety stop or HPA capped at six while
SLO fails.

With five seconds think time:
sustainable active users equals the highest PASS VU.
One VU theoretically creates 0.2 RPS.
Active users can be checked as sustainable RPS multiplied by five.

PASS below six Pods is operational capacity. PASS requiring six Pods is observed
maximum without burst headroom. Do not extrapolate to login, upload, admin,
recommendation or writing API.

## Handover report

Create docs/monitoring/reports/GKE_BACKEND_CAPACITY_REPORT_YYYY-MM-DD.md with
environment, digest, SHA, HPA resources quota nodes Cloud SQL; workload tiers
thresholds and stop rules; a tier table with VU RPS p50 p95 p99 errors dashboard
p95 and 5xx desired ready CPU restarts and verdict; dashboard links or
screenshots; artifact paths; evidence based bottleneck analysis; one numerical
user capacity conclusion with assumptions; and ranked recommendations. Do not
commit large raw artifacts, tokens or response bodies.

References:
https://cloud.google.com/kubernetes-engine/docs/troubleshooting/horizontal-pod-autoscaling
https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/constant-vus/
https://grafana.com/docs/k6/latest/using-k6/thresholds/
