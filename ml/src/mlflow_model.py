import argparse
import json
import os
import sys
from pathlib import Path

import mlflow

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-path", required=True, help="Path to model.joblib")
    parser.add_argument("--metrics-path", required=True, help="Path to evaluation_metrics.json")
    parser.add_argument("--train-metrics-path", required=True, help="Path to train metrics.json")
    parser.add_argument("--manifest-path", required=True, help="Path to snapshot manifest.json")
    parser.add_argument("--report-path", required=True, help="Path to validation_report.json")
    parser.add_argument("--experiment-name", default="philobiblus-content-recommender")
    args = parser.parse_args()

    # Read data
    with open(args.metrics_path) as f:
        eval_metrics = json.load(f)
        
    with open(args.train_metrics_path) as f:
        train_metrics = json.load(f)
        
    with open(args.manifest_path) as f:
        manifest = json.load(f)
        
    with open(args.report_path) as f:
        report = json.load(f)

    # MLflow Setup
    tracking_uri = os.getenv("MLFLOW_TRACKING_URI", "http://mlflow.philobiblus-mlops.svc.cluster.local:5000")
    mlflow.set_tracking_uri(tracking_uri)

    experiment = mlflow.get_experiment_by_name(args.experiment_name)
    if experiment is None:
        mlflow.create_experiment(args.experiment_name)
    mlflow.set_experiment(args.experiment_name)

    model_version = f"tfidf-v2-{manifest['sha256'][:12]}-{manifest['git_sha'][:7]}"

    with mlflow.start_run(run_name=model_version):
        # Log params
        mlflow.log_param("snapshot_id", manifest["snapshot_id"])
        mlflow.log_param("git_sha", manifest["git_sha"])
        mlflow.log_param("training_image_digest", manifest["training_image_digest"])
        
        # Log tags
        mlflow.set_tag("artifact_schema_version", "2")
        mlflow.set_tag("snapshot_sha256", manifest["sha256"])
        mlflow.set_tag("git_sha", manifest["git_sha"])
        mlflow.set_tag("training_image_digest", manifest["training_image_digest"])
        
        # Gate decision based on evaluated_profiles
        if eval_metrics.get("evaluated_profiles", 0) < 100:
            validation_status = "insufficient_data"
        else:
            # Maybe add more quality gates here like minimum hit_rate
            validation_status = "pending"
            
        mlflow.set_tag("validation_status", validation_status)
        
        # Log metrics
        metrics = {**eval_metrics, **train_metrics}
        metrics["new_books"] = report.get("new_books", 0)
        metrics["updated_books"] = report.get("updated_books", 0)
        metrics["removed_books"] = report.get("removed_books", 0)
        
        mlflow.log_metrics(metrics)
        
        # Log artifacts
        mlflow.log_artifact(args.model_path, artifact_path="model")
        mlflow.log_artifact(args.manifest_path, artifact_path="snapshot")
        mlflow.log_artifact(args.report_path, artifact_path="reports")

    print(f"MLflow run completed. Status: {validation_status}")

if __name__ == "__main__":
    main()
