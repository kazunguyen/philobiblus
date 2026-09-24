"""Orchestrate a retraining run inside the Kubernetes CronJob image."""

import argparse
import datetime as dt
import json
import logging
import os
import subprocess
import sys
from pathlib import Path

import pandas as pd
from google.api_core.exceptions import NotFound
from google.cloud import storage
from kubernetes import client, config


LOGGER = logging.getLogger(__name__)


def run_step(command: list[str], name: str, environment: dict[str, str] | None = None) -> None:
    LOGGER.info("starting step=%s", name)
    subprocess.run(command, check=True, env=environment)
    LOGGER.info("completed step=%s", name)


def parse_gs_uri(uri: str) -> tuple[str, str]:
    if not uri.startswith("gs://") or "/" not in uri[5:]:
        raise ValueError(f"Invalid GCS URI: {uri}")
    return tuple(uri[5:].split("/", 1))  # type: ignore[return-value]


def fetch_champion(bucket_name: str, destination: Path, namespace: str, configmap_name: str) -> dict | None:
    """Read the active release pointer; absence is normal before the first bootstrap."""
    try:
        try:
            config.load_incluster_config()
        except config.ConfigException:
            config.load_kube_config()
        release = client.CoreV1Api().read_namespaced_config_map(configmap_name, namespace).data or {}
        manifest_uri = release.get("release_manifest_uri")
        if not manifest_uri and release.get("model_uri"):
            manifest_uri = release["model_uri"].rsplit("/", 1)[0] + "/manifest.json"
        if not manifest_uri:
            return None
        manifest_bucket, manifest_blob = parse_gs_uri(manifest_uri)
        if manifest_bucket != bucket_name:
            raise ValueError("Champion release points to a different MLOps bucket")
        destination.mkdir(parents=True, exist_ok=True)
        manifest_path = destination / "champion_manifest.json"
        storage.Client().bucket(bucket_name).blob(manifest_blob).download_to_filename(str(manifest_path))
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        snapshot_id = manifest.get("snapshot_id")
        if snapshot_id:
            storage.Client().bucket(bucket_name).blob(f"snapshots/{snapshot_id}/catalog.parquet").download_to_filename(
                str(destination / "champion_catalog.parquet")
            )
        return manifest
    except (config.ConfigException, client.exceptions.ApiException, NotFound) as error:
        LOGGER.info("No readable champion release yet: %s", error)
        return None


def champion_is_fresh(champion: dict, current_snapshot_sha: str, max_age_hours: int) -> bool:
    if champion.get("snapshot_sha256") != current_snapshot_sha:
        return False
    promoted_at = champion.get("promoted_at")
    if not promoted_at:
        return False
    try:
        age = dt.datetime.now(dt.timezone.utc) - dt.datetime.fromisoformat(promoted_at.replace("Z", "+00:00"))
    except ValueError:
        return False
    return age <= dt.timedelta(hours=max_age_hours)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db-uri", required=True)
    parser.add_argument("--mlops-bucket", required=True)
    parser.add_argument("--workspace-dir", default="/workspace")
    parser.add_argument("--namespace", default=os.getenv("APP_NAMESPACE", "philobiblus"))
    parser.add_argument("--model-release-configmap", default="model-release")
    parser.add_argument("--max-champion-age-hours", type=int, default=168)
    parser.add_argument("--recommendation-service-url", default="")
    parser.add_argument("--allow-bootstrap", action="store_true")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    source_dir = Path(__file__).resolve().parent
    ml_dir = source_dir.parent
    workspace = Path(args.workspace_dir)
    snapshot_dir, champion_dir = workspace / "snapshot", workspace / "champion"
    snapshot_dir.mkdir(parents=True, exist_ok=True)
    environment = os.environ.copy()

    run_step(
        [sys.executable, str(source_dir / "snapshot_catalog.py"), "--db-uri", args.db_uri,
         "--bucket", args.mlops_bucket, "--output-dir", str(snapshot_dir)],
        "snapshot", environment,
    )
    manifest = json.loads((snapshot_dir / "manifest.json").read_text(encoding="utf-8"))
    champion = fetch_champion(args.mlops_bucket, champion_dir, args.namespace, args.model_release_configmap)
    if champion and not args.force and champion_is_fresh(champion, manifest["sha256"], args.max_champion_age_hours):
        LOGGER.info("Skipping: champion already serves snapshot=%s and is within max age", manifest["snapshot_id"])
        print(json.dumps({"status": "skipped", "reason": "unchanged_fresh_champion", "snapshot_id": manifest["snapshot_id"]}))
        return

    validation = [sys.executable, str(source_dir / "validate_snapshot.py"), "--snapshot-dir", str(snapshot_dir)]
    if (champion_dir / "champion_manifest.json").is_file():
        validation += ["--champion-manifest", str(champion_dir / "champion_manifest.json")]
    if (champion_dir / "champion_catalog.parquet").is_file():
        validation += ["--champion-catalog", str(champion_dir / "champion_catalog.parquet")]
    run_step(validation, "validate-snapshot", environment)

    data_dir = workspace / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    raw_csv, prepared_data = data_dir / "raw.csv", data_dir / "prepared.csv"
    pd.read_parquet(snapshot_dir / "catalog.parquet").to_csv(raw_csv, index=False)
    run_step([sys.executable, str(source_dir / "prepare.py"), "--input", str(raw_csv), "--output", str(prepared_data)], "prepare", environment)

    model_path, train_metrics = workspace / "model.joblib", workspace / "train_metrics.json"
    environment["SNAPSHOT_ID"] = manifest["snapshot_id"]
    run_step(
        [sys.executable, str(source_dir / "train.py"), "--input", str(prepared_data), "--params", str(ml_dir / "params.yaml"),
         "--model-output", str(model_path), "--metrics-output", str(train_metrics)],
        "train", environment,
    )
    eval_metrics = workspace / "eval_metrics.json"
    run_step(
        [sys.executable, str(source_dir / "evaluate.py"), "--db-uri", args.db_uri, "--model-path", str(model_path),
         "--output-metrics", str(eval_metrics)],
        "evaluate", environment,
    )
    mlflow_result = workspace / "mlflow_result.json"
    run_step(
        [sys.executable, str(source_dir / "mlflow_model.py"), "--model-path", str(model_path), "--metrics-path", str(eval_metrics),
         "--train-metrics-path", str(train_metrics), "--manifest-path", str(snapshot_dir / "manifest.json"),
         "--report-path", str(snapshot_dir / "validation_report.json"), "--params", str(ml_dir / "params.yaml"),
         "--result-path", str(mlflow_result)],
        "mlflow-register-and-gate", environment,
    )
    result = json.loads(mlflow_result.read_text(encoding="utf-8"))
    if result["validation_status"] != "passed":
        LOGGER.warning("Candidate is not promotable: %s", result["validation_status"])
        print(json.dumps({"status": "not_promoted", **result}, sort_keys=True))
        return
    if champion is None and not args.allow_bootstrap:
        # A first candidate must be explicitly approved before it can replace
        # the serving model.  Scheduled runs remain successful and auditable
        # instead of failing once the data first passes the quality gate.
        LOGGER.warning("Candidate passed but bootstrap approval is still required")
        print(json.dumps({"status": "pending_bootstrap", **result}, sort_keys=True))
        return
    promote = [
        sys.executable, str(source_dir / "promote.py"), "--model-path", str(model_path),
        "--manifest-path", str(snapshot_dir / "manifest.json"), "--mlflow-result", str(mlflow_result),
        "--mlops-bucket", args.mlops_bucket, "--namespace", args.namespace,
        "--model-release-configmap", args.model_release_configmap,
    ]
    if args.recommendation_service_url:
        promote += ["--service-url", args.recommendation_service_url]
    if args.allow_bootstrap:
        promote.append("--allow-bootstrap")
    run_step(promote, "promote", environment)


if __name__ == "__main__":
    main()
