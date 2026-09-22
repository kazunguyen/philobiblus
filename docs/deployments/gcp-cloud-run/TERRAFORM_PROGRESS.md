# Terraform GCP progress

Last updated: 2026-09-20

## Completed

- Created the protected GCS Terraform-state bucket `your-gcp-project-id-tfstate-your-project-number`.
- Applied the `foundation` module in project `your-gcp-project-id`, region `asia-southeast1`.
- Pushed immutable public Docker Hub images for the backend and recommendation service. Their digest references are recorded in [DEPLOYMENT_IMAGE_DIGESTS.example.md](DEPLOYMENT_IMAGE_DIGESTS.example.md).
- Added version `1` to the `DATABASE_URL` and `SECRET_KEY` Secret Manager secrets.

## In progress

- The runtime module is deployed and Terraform manages the backend, recommendation service, seed job, and their IAM bindings.
- DATABASE_URL, SECRET_KEY, and ImgBB API secrets have enabled versions.

## Next

- Run the runtime apply script when a live backend, recommendation service, and seed job are needed again.
- Run the initial seed job, then verify backend health, logs, recommendation behaviour, and Cloud SQL status.
- Set the frontend VITE_API_URL GitHub variable to the deployed backend URL plus /api.
- Add Cloud Monitoring notification and alert-policy resources if email alerts are required.

## Runtime deployment

Runtime is deployed. The runtime plan creates the backend Cloud Run service, internal recommendation Cloud Run service, seed job, and their IAM bindings.

## Credential initialization

Use `bash scripts/gcp-shared/terraform-secrets-apply.sh` only for a fresh environment. It creates the Cloud SQL application user and new secret versions without exposing values in Terraform state or `terraform.tfvars`.

If the database user already exists, the script stops to prevent accidental password rotation. Use `ROTATE_DB_PASSWORD=true` only when intentionally rotating both the Cloud SQL password and the database URL secret.
