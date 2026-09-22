# Deployment evidence map

| Deployment path | Implementation artefacts | Runbooks and evidence |
|---|---|---|
| Docker Compose | `docker-compose.yaml`, `nginx/` | Root `README.md` |
| Kubernetes manifests | `kubernetes/manifests/` | `kubernetes/manifests/README.md` |
| Local Kubernetes Helm | `kubernetes/helm/philobiblus/`, `monitoring/`, `scripts/local-kubernetes/` | Root `README.md`, `docs/monitoring/alert-runbooks.md` |
| GCP shared foundation | `infrastructure/terraform/bootstrap/`, `infrastructure/terraform/foundation/`, `scripts/gcp-shared/` | `TERRAFORM_MODULES.md` |
| GCP Cloud Run | `infrastructure/terraform/runtime/`, `scripts/gcp-cloud-run/` | `gcp-cloud-run/` |
| GCP GKE | `infrastructure/terraform/gke-platform/`, `gke-app/`, `gke-observability/`, `https-proxy/`, `scripts/gcp-gke/` | `gcp-gke/` |

The archived plan-history and generic gap-analysis files are kept in
`docs/archive/` because they no longer represent the current implementation.
The concrete deployment configuration, runbooks, screenshots, and reports
remain in their active locations.
