"""Promote only an MLflow-gated candidate through a verified Kubernetes rollout."""

import argparse
import datetime as dt
import hashlib
import json
import logging
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import mlflow
from google.api_core.exceptions import PreconditionFailed
from google.cloud import storage
from kubernetes import client, config
from mlflow.tracking import MlflowClient


LOGGER = logging.getLogger(__name__)


def hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def upload_immutable(bucket: storage.Bucket, name: str, local_path: Path) -> None:
    blob = bucket.blob(name)
    try:
        blob.upload_from_filename(str(local_path), if_generation_match=0)
    except PreconditionFailed:
        existing = local_path.with_name(f".{local_path.name}.remote")
        try:
            blob.download_to_filename(str(existing))
            if hash_file(existing) != hash_file(local_path):
                raise RuntimeError(f"Immutable object collision at gs://{bucket.name}/{name}")
        finally:
            existing.unlink(missing_ok=True)


def replace_configmap(core: client.CoreV1Api, namespace: str, name: str, new_data: dict[str, str], allow_bootstrap: bool) -> dict[str, str]:
    for _ in range(3):
        try:
            current = core.read_namespaced_config_map(name, namespace)
        except client.exceptions.ApiException as error:
            if error.status != 404 or not allow_bootstrap:
                raise RuntimeError("model-release ConfigMap is missing; bootstrap a known-good release first") from error
            core.create_namespaced_config_map(namespace, client.V1ConfigMap(metadata=client.V1ObjectMeta(name=name), data=new_data))
            return {}
        previous = dict(current.data or {})
        current.data = new_data
        try:
            core.replace_namespaced_config_map(name, namespace, current)
            return previous
        except client.exceptions.ApiException as error:
            if error.status != 409:
                raise
    raise RuntimeError("Concurrent model-release update did not converge")


def patch_deployment(apps: client.AppsV1Api, namespace: str, name: str, model_version: str) -> None:
    apps.patch_namespaced_deployment(
        name, namespace,
        {"spec": {"template": {"metadata": {"annotations": {"mlops.philobiblus.io/model-version": model_version}}}}},
    )


def deployment_ready(apps: client.AppsV1Api, namespace: str, name: str, timeout_seconds: int) -> bool:
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        deployment = apps.read_namespaced_deployment(name, namespace)
        status, spec = deployment.status, deployment.spec
        if (status.observed_generation and status.observed_generation >= deployment.metadata.generation and
                status.ready_replicas == spec.replicas and status.updated_replicas == spec.replicas and
                status.available_replicas == spec.replicas):
            return True
        time.sleep(5)
    return False


def service_reports_version(url: str, model_version: str, timeout_seconds: int) -> bool:
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(f"{url.rstrip('/')}/health", timeout=5) as response:
                payload = json.loads(response.read().decode("utf-8"))
                if payload.get("model_version") == model_version:
                    return True
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            pass
        time.sleep(5)
    return False


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-path", required=True)
    parser.add_argument("--manifest-path", required=True)
    parser.add_argument("--mlflow-result", required=True)
    parser.add_argument("--mlops-bucket", required=True)
    parser.add_argument("--namespace", default="philobiblus")
    parser.add_argument("--model-release-configmap", default="model-release")
    parser.add_argument("--deployment-name", default="philobiblus-recommendation")
    parser.add_argument("--service-url", default="http://philobiblus-recommendation.philobiblus.svc.cluster.local:8000")
    parser.add_argument("--rollout-timeout-seconds", type=int, default=300)
    parser.add_argument("--allow-bootstrap", action="store_true")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    model_path = Path(args.model_path)
    manifest = json.loads(Path(args.manifest_path).read_text(encoding="utf-8"))
    result = json.loads(Path(args.mlflow_result).read_text(encoding="utf-8"))
    if result.get("validation_status") != "passed":
        raise RuntimeError("Promotion refused: candidate did not pass the quality gate")
    model_version, model_sha256 = result["model_version"], hash_file(model_path)
    bucket = storage.Client().bucket(args.mlops_bucket)
    model_uri = f"gs://{args.mlops_bucket}/models/{model_version}/model.joblib"
    upload_immutable(bucket, f"models/{model_version}/model.joblib", model_path)
    release_manifest = {
        "schema_version": 2, "model_version": model_version, "artifact_schema_version": 2,
        "model_uri": model_uri, "sha256": model_sha256, "snapshot_id": manifest["snapshot_id"],
        "snapshot_sha256": manifest["sha256"], "row_count": manifest["row_count"],
        "mlflow_run_id": result["run_id"], "registry_model_name": result["registry_model_name"],
        "registry_version": result["registry_version"], "git_sha": manifest["git_sha"],
        "training_image_digest": manifest["training_image_digest"], "promoted_at": dt.datetime.now(dt.timezone.utc).isoformat(),
    }
    local_release = model_path.parent / "release-manifest.json"
    local_release.write_text(json.dumps(release_manifest, indent=2, sort_keys=True), encoding="utf-8")
    upload_immutable(bucket, f"models/{model_version}/manifest.json", local_release)
    upload_immutable(bucket, f"releases/{model_version}.json", local_release)

    try:
        config.load_incluster_config()
    except config.ConfigException:
        config.load_kube_config()
    core, apps = client.CoreV1Api(), client.AppsV1Api()
    previous_data = {}
    new_data = {
        "model_uri": model_uri, "model_sha256": model_sha256, "model_version": model_version,
        "release_manifest_uri": f"gs://{args.mlops_bucket}/models/{model_version}/manifest.json",
    }
    try:
        previous_data = replace_configmap(core, args.namespace, args.model_release_configmap, new_data, args.allow_bootstrap)
        patch_deployment(apps, args.namespace, args.deployment_name, model_version)
        healthy = deployment_ready(apps, args.namespace, args.deployment_name, args.rollout_timeout_seconds)
        healthy = healthy and service_reports_version(args.service_url, model_version, args.rollout_timeout_seconds)
        if not healthy:
            raise RuntimeError("Deployment rollout or /health model-version check failed")
    except Exception:
        if previous_data:
            replace_configmap(core, args.namespace, args.model_release_configmap, previous_data, True)
            patch_deployment(apps, args.namespace, args.deployment_name, previous_data.get("model_version", "rollback"))
        client_mlflow = MlflowClient()
        client_mlflow.set_tag(result["run_id"], "validation_status", "rolled_back")
        client_mlflow.set_tag(result["run_id"], "deployment_status", "failed")
        raise
    client_mlflow = MlflowClient()
    client_mlflow.set_registered_model_alias(result["registry_model_name"], "candidate", result["registry_version"])
    client_mlflow.set_registered_model_alias(result["registry_model_name"], "champion", result["registry_version"])
    client_mlflow.set_tag(result["run_id"], "deployment_status", "champion")
    print(json.dumps({"status": "promoted", "model_version": model_version}, sort_keys=True))


if __name__ == "__main__":
    main()
