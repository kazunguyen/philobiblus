# Deployment scripts

The scripts are grouped by the deployment path they support. Run every script
from the repository root with `bash <path-to-script>`.

| Directory | Scope |
|---|---|
| `local-kubernetes/` | Local k3d/Helm monitoring, temporary Cloudflare tunnel, and HPA load verification. |
| `gcp-shared/` | GCP prerequisites, Terraform bootstrap/foundation lifecycle, shared secrets, and immutable container-image publishing. |
| `gcp-cloud-run/` | Cloud Run runtime configuration, deployment, release, seed/verification, runtime teardown, and GitHub Pages cutover. |
| `gcp-gke/` | GKE platform, Helm application, HTTPS proxy, Managed Prometheus observability, verification, and guarded GKE teardown. |

`gcp-shared/terraform-delete.sh` affects the shared GCP foundation and checks
for active GKE and Cloud Run state before it can continue. It is not a
Cloud-Run-only teardown command.
