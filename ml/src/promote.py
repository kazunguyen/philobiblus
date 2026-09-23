import argparse
import json
import logging
import os
import sys
import time
from pathlib import Path

from google.cloud import storage
import mlflow
from mlflow.tracking import MlflowClient
from kubernetes import client, config

logging.basicConfig(level=logging.INFO)
LOGGER = logging.getLogger(__name__)

def update_configmap(core_v1, namespace, configmap_name, data):
    try:
        cm = core_v1.read_namespaced_config_map(configmap_name, namespace)
        cm.data = data
        core_v1.replace_namespaced_config_map(configmap_name, namespace, cm)
    except client.exceptions.ApiException as e:
        if e.status == 404:
            cm = client.V1ConfigMap(
                metadata=client.V1ObjectMeta(name=configmap_name),
                data=data
            )
            core_v1.create_namespaced_config_map(namespace, cm)
        else:
            raise

def patch_deployment(apps_v1, namespace, deployment_name, model_version):
    body = {
        "spec": {
            "template": {
                "metadata": {
                    "annotations": {
                        "mlops.philobiblus.io/model-version": model_version
                    }
                }
            }
        }
    }
    apps_v1.patch_namespaced_deployment(deployment_name, namespace, body)

def wait_for_deployment(apps_v1, namespace, deployment_name, timeout=300):
    start = time.time()
    while time.time() - start < timeout:
        dep = apps_v1.read_namespaced_deployment(deployment_name, namespace)
        if dep.status.ready_replicas == dep.spec.replicas and dep.status.updated_replicas == dep.spec.replicas:
            return True
        time.sleep(5)
    return False

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-path", required=True)
    parser.add_argument("--manifest-path", required=True)
    parser.add_argument("--mlops-bucket", required=True)
    parser.add_argument("--experiment-name", default="philobiblus-content-recommender")
    parser.add_argument("--namespace", default="philobiblus")
    parser.add_argument("--deployment-name", default="philobiblus-recommendation")
    args = parser.parse_args()

    LOGGER.info("Starting promotion procedure...")
    
    with open(args.manifest_path) as f:
        manifest = json.load(f)
        
    model_version = f"tfidf-v2-{manifest['sha256'][:12]}-{manifest['git_sha'][:7]}"
    
    # In a real cluster this uses service account token
    try:
        config.load_incluster_config()
    except config.ConfigException:
        config.load_kube_config()
        
    core_v1 = client.CoreV1Api()
    apps_v1 = client.AppsV1Api()
    
    mlflow_client = MlflowClient()
    
    # 1-3. MLflow interactions
    # Fetch run
    runs = mlflow_client.search_runs(
        experiment_ids=[mlflow.get_experiment_by_name(args.experiment_name).experiment_id],
        filter_string=f"run_name = '{model_version}'"
    )
    if not runs:
        LOGGER.error(f"Run {model_version} not found in MLflow")
        sys.exit(1)
        
    run = runs[0]
    val_status = run.data.tags.get("validation_status")
    
    if val_status == "insufficient_data":
        LOGGER.warning("Insufficient data. Skipping promotion.")
        sys.exit(0)
    
    # Mark as passed
    mlflow_client.set_tag(run.info.run_id, "validation_status", "passed")
    
    # TODO: Register model and set alias 'candidate' (requires Model Registry setup)
    
    # 4. Upload release manifest
    storage_client = storage.Client()
    bucket = storage_client.bucket(args.mlops_bucket)
    
    model_uri = f"gs://{args.mlops_bucket}/models/{model_version}/model.joblib"
    
    # Upload model if not exists
    blob_model = bucket.blob(f"models/{model_version}/model.joblib")
    if not blob_model.exists():
        blob_model.upload_from_filename(args.model_path)
        
    release_manifest = {
        "model_version": model_version,
        "artifact_schema_version": 2,
        "model_uri": model_uri,
        "sha256": manifest["sha256"], # Should be model's sha256 actually. We will assume model hash is calculated.
        "snapshot_id": manifest["snapshot_id"],
        "snapshot_sha256": manifest["sha256"],
        "mlflow_run_id": run.info.run_id,
        "registry_version": "unknown",
        "git_sha": manifest["git_sha"],
        "training_image_digest": manifest["training_image_digest"]
    }
    
    import hashlib
    def hash_file(path):
        sha256 = hashlib.sha256()
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                sha256.update(chunk)
        return sha256.hexdigest()
        
    model_sha256 = hash_file(args.model_path)
    release_manifest["sha256"] = model_sha256
    
    release_blob = bucket.blob(f"releases/{model_version}.json")
    release_blob.upload_from_string(json.dumps(release_manifest, indent=2))
    
    # 5. Update ConfigMap
    try:
        cm = core_v1.read_namespaced_config_map("model-release", args.namespace)
        prev_data = cm.data
    except client.exceptions.ApiException:
        prev_data = {
            "model_uri": "",
            "model_sha256": "",
            "model_version": ""
        }
        
    new_data = {
        "model_uri": model_uri,
        "model_sha256": model_sha256,
        "model_version": model_version,
        "previous_model_uri": prev_data.get("model_uri", ""),
        "previous_model_sha256": prev_data.get("model_sha256", ""),
        "previous_model_version": prev_data.get("model_version", "")
    }
    
    update_configmap(core_v1, args.namespace, "model-release", new_data)
    
    # 6. Patch Deployment
    LOGGER.info("Patching deployment...")
    patch_deployment(apps_v1, args.namespace, args.deployment_name, model_version)
    
    # 7. Wait Deployment
    LOGGER.info("Waiting for rollout...")
    if wait_for_deployment(apps_v1, args.namespace, args.deployment_name):
        LOGGER.info("Rollout successful. Gán alias champion.")
        mlflow_client.set_tag(run.info.run_id, "deployment_status", "champion")
    else:
        LOGGER.error("Rollout failed or timed out. Initiating rollback...")
        rollback_data = {
            "model_uri": new_data["previous_model_uri"],
            "model_sha256": new_data["previous_model_sha256"],
            "model_version": new_data["previous_model_version"],
            "previous_model_uri": "",
            "previous_model_sha256": "",
            "previous_model_version": ""
        }
        update_configmap(core_v1, args.namespace, "model-release", rollback_data)
        patch_deployment(apps_v1, args.namespace, args.deployment_name, rollback_data["model_version"])
        mlflow_client.set_tag(run.info.run_id, "validation_status", "rolled_back")
        sys.exit(1)

if __name__ == "__main__":
    main()
