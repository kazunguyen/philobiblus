# Deployment image digests (example)

Copy this file to `DEPLOYMENT_IMAGE_DIGESTS.md` only when you need a local record of the images deployed to an environment. The real file is ignored because it can identify a personal container registry account.

| Service | Immutable image reference |
| --- | --- |
| Backend | `your-dockerhub-username/philobiblus-backend@sha256:replace-with-image-digest` |
| Recommendation service | `your-dockerhub-username/philobiblus-recommendation@sha256:replace-with-image-digest` |

Use immutable digests in `infrastructure/terraform/runtime/images.auto.tfvars`; do not use the mutable `latest` tag.
