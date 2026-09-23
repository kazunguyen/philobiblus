import argparse
import logging
import os
import subprocess
import sys
from pathlib import Path

logging.basicConfig(level=logging.INFO)
LOGGER = logging.getLogger(__name__)

def run_step(cmd, step_name):
    LOGGER.info(f"--- Starting step: {step_name} ---")
    result = subprocess.run(cmd)
    if result.returncode != 0:
        LOGGER.error(f"Step {step_name} failed with exit code {result.returncode}")
        sys.exit(result.returncode)
    LOGGER.info(f"--- Step {step_name} completed ---")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--db-uri", required=True)
    parser.add_argument("--mlops-bucket", required=True)
    parser.add_argument("--workspace-dir", default="/workspace")
    args = parser.parse_args()

    workspace = Path(args.workspace_dir)
    snapshot_dir = workspace / "snapshot"
    snapshot_dir.mkdir(parents=True, exist_ok=True)
    
    # 1. Extract Snapshot
    run_step([
        sys.executable, "ml/src/snapshot_catalog.py",
        "--db-uri", args.db_uri,
        "--bucket", args.mlops_bucket,
        "--output-dir", str(snapshot_dir)
    ], "Extract Snapshot")
    
    # 2. Validate Snapshot
    # TODO: Fetch champion manifest if available
    run_step([
        sys.executable, "ml/src/validate_snapshot.py",
        "--snapshot-dir", str(snapshot_dir)
    ], "Validate Snapshot")
    
    # 3. Skip or Prepare
    # (assuming skip logic will be handled inside validate_snapshot.py returning a specific code, 
    # but for now we proceed)
    
    data_dir = workspace / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    prepared_data = data_dir / "prepared.csv"
    
    # We first need to convert parquet back to CSV for prepare.py, or adapt prepare.py to read parquet.
    # We will adapt prepare.py later, or just convert it here.
    import pandas as pd
    df = pd.read_parquet(snapshot_dir / "catalog.parquet")
    raw_csv = data_dir / "raw.csv"
    df.to_csv(raw_csv, index=False)
    
    run_step([
        sys.executable, "ml/src/prepare.py",
        "--input", str(raw_csv),
        "--output", str(prepared_data)
    ], "Prepare Data")
    
    # 4. Train
    model_output = workspace / "model.joblib"
    train_metrics = workspace / "train_metrics.json"
    run_step([
        sys.executable, "ml/src/train.py",
        "--input", str(prepared_data),
        "--params", "ml/params.yaml",
        "--model-output", str(model_output),
        "--metrics-output", str(train_metrics)
    ], "Train Sparse Model")
    
    # 5. Offline Evaluation
    eval_metrics = workspace / "eval_metrics.json"
    run_step([
        sys.executable, "ml/src/evaluate.py",
        "--db-uri", args.db_uri,
        "--model-path", str(model_output),
        "--output-metrics", str(eval_metrics)
    ], "Offline Evaluation")
    
    # 6. MLflow Log
    report_path = snapshot_dir / "validation_report.json"
    manifest_path = snapshot_dir / "manifest.json"
    
    run_step([
        sys.executable, "ml/src/mlflow_model.py",
        "--model-path", str(model_output),
        "--metrics-path", str(eval_metrics),
        "--train-metrics-path", str(train_metrics),
        "--manifest-path", str(manifest_path),
        "--report-path", str(report_path)
    ], "MLflow Log and Register")
    
    # 7. Promote (Upload immutable bundle & Update ConfigMap)
    run_step([
        sys.executable, "ml/src/promote.py",
        "--model-path", str(model_output),
        "--manifest-path", str(manifest_path),
        "--mlops-bucket", args.mlops_bucket
    ], "Promote Candidate")

if __name__ == "__main__":
    main()
