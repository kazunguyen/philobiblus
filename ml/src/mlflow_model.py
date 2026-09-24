"""Log, register, and quality-gate one immutable recommender candidate."""

import argparse
import json
import logging
import os
from pathlib import Path

import joblib
import mlflow
import pandas as pd
import yaml
from mlflow.exceptions import MlflowException
from mlflow.tracking import MlflowClient


LOGGER = logging.getLogger(__name__)


class CatalogArtifactModel(mlflow.pyfunc.PythonModel):
    """A registry package for governance; serving uses the verified joblib artifact."""

    def load_context(self, context) -> None:
        self.artifact = joblib.load(context.artifacts["recommender_artifact"])

    def predict(self, context, model_input: pd.DataFrame, params=None) -> pd.DataFrame:
        # A deliberately small, inspectable registry interface. Online ranking remains in
        # recommendation-service so a malformed registry package cannot change serving code.
        return pd.DataFrame({
            "model_version": [self.artifact["model_version"]] * len(model_input),
            "catalog_size": [len(self.artifact["catalog"])] * len(model_input),
        })


def champion_metrics(client: MlflowClient, name: str) -> dict[str, float] | None:
    try:
        champion = client.get_model_version_by_alias(name, "champion")
        return dict(client.get_run(champion.run_id).data.metrics)
    except (MlflowException, AttributeError):
        return None


def quality_gate(metrics: dict, promotion: dict, champion: dict[str, float] | None) -> str:
    if int(metrics.get("evaluated_profiles", 0)) < int(promotion["min_evaluated_profiles"]):
        return "insufficient_data"
    if float(metrics.get("hit_rate_at_5", 0)) < float(promotion["min_hit_rate_at_5"]):
        return "rejected_quality"
    if float(metrics.get("catalog_coverage_at_5", 0)) < float(promotion["min_catalog_coverage_at_5"]):
        return "rejected_quality"
    if champion:
        floor = float(champion.get("hit_rate_at_5", 0)) - float(promotion["max_hit_rate_regression"])
        if float(metrics.get("hit_rate_at_5", 0)) < floor:
            return "rejected_regression"
    return "passed"


def register_model(client: MlflowClient, model_uri: str, registered_name: str) -> str:
    try:
        client.create_registered_model(registered_name)
    except MlflowException:
        pass  # Already registered is expected after the first successful run.
    return str(mlflow.register_model(model_uri, registered_name).version)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-path", required=True)
    parser.add_argument("--metrics-path", required=True)
    parser.add_argument("--train-metrics-path", required=True)
    parser.add_argument("--manifest-path", required=True)
    parser.add_argument("--report-path", required=True)
    parser.add_argument("--params", required=True)
    parser.add_argument("--result-path", required=True)
    parser.add_argument("--experiment-name", default="philobiblus-content-recommender")
    parser.add_argument("--registered-model-name", default="philobiblus-content-recommender")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    eval_metrics = json.loads(Path(args.metrics_path).read_text(encoding="utf-8"))
    train_metrics = json.loads(Path(args.train_metrics_path).read_text(encoding="utf-8"))
    manifest = json.loads(Path(args.manifest_path).read_text(encoding="utf-8"))
    report = json.loads(Path(args.report_path).read_text(encoding="utf-8"))
    promotion = yaml.safe_load(Path(args.params).read_text(encoding="utf-8"))["promotion"]
    tracking_uri = os.getenv("MLFLOW_TRACKING_URI")
    if not tracking_uri:
        raise RuntimeError("MLFLOW_TRACKING_URI must point to the in-cluster MLflow service")
    mlflow.set_tracking_uri(tracking_uri)
    client = MlflowClient()
    experiment = mlflow.get_experiment_by_name(args.experiment_name)
    if experiment is None:
        try:
            experiment_id = mlflow.create_experiment(args.experiment_name)
        except MlflowException:
            experiment = mlflow.get_experiment_by_name(args.experiment_name)
            if experiment is None:
                raise
            experiment_id = experiment.experiment_id
    else:
        experiment_id = experiment.experiment_id
    model_version = f"tfidf-v2-{manifest['sha256'][:12]}-{manifest['git_sha'][:7]}"
    metrics = {**eval_metrics, **train_metrics, **{key: report.get(key, 0) for key in ("new_books", "updated_books", "removed_books")}}
    champion = champion_metrics(client, args.registered_model_name)
    status = quality_gate(metrics, promotion, champion)
    with mlflow.start_run(experiment_id=experiment_id, run_name=model_version) as run:
        mlflow.log_params({
            "snapshot_id": manifest["snapshot_id"], "git_sha": manifest["git_sha"],
            "training_image_digest": manifest["training_image_digest"], "model_release_version": model_version,
        })
        mlflow.set_tags({
            "artifact_schema_version": "2", "snapshot_sha256": manifest["sha256"],
            "validation_status": status, "model_type": "sparse-tfidf-cosine",
        })
        mlflow.log_metrics({key: float(value) for key, value in metrics.items()})
        mlflow.log_artifact(args.manifest_path, artifact_path="snapshot")
        mlflow.log_artifact(args.report_path, artifact_path="reports")
        model_info = mlflow.pyfunc.log_model(
            name="model",
            python_model=CatalogArtifactModel(),
            artifacts={"recommender_artifact": args.model_path},
        )
        registry_version = register_model(client, model_info.model_uri, args.registered_model_name)
        client.set_model_version_tag(args.registered_model_name, registry_version, "validation_status", status)
        client.set_model_version_tag(args.registered_model_name, registry_version, "snapshot_sha256", manifest["sha256"])
        result = {
            "run_id": run.info.run_id,
            "model_version": model_version,
            "registry_model_name": args.registered_model_name,
            "registry_version": registry_version,
            "validation_status": status,
        }
    Path(args.result_path).write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    main()
