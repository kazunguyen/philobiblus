import argparse
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import yaml
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

import os
import mlflow


parser = argparse.ArgumentParser()
parser.add_argument("--input", required=True)
parser.add_argument("--params", required=True)
parser.add_argument("--model-output", required=True)
parser.add_argument("--metrics-output", required=True)
args = parser.parse_args()

with open(args.params, encoding="utf-8") as file:
    config = yaml.safe_load(file)["train"]

books = pd.read_csv(args.input)

feature_columns = ["title", "author", "genre"]

if config["include_tags"]:
    feature_columns.append("tags_text")

books["feature_text"] = (
    books[feature_columns]
    .fillna("")
    .astype(str)
    .agg(" ".join, axis=1)
    .str.lower()
)

vectorizer = TfidfVectorizer(
    ngram_range=tuple(config["ngram_range"]),
    min_df=config["min_df"],
)
feature_matrix = vectorizer.fit_transform(books["feature_text"])
similarity = cosine_similarity(feature_matrix)

np.fill_diagonal(similarity, -1.0)

artifact = {
    "model_version": config["model_version"],
    "vectorizer": vectorizer,
    "similarity_matrix": similarity,
    "catalog": books[
        ["book_id", "title", "author", "genre", "cover_url"]
    ].to_dict(orient="records"),
}

model_output = Path(args.model_output)
model_output.parent.mkdir(parents=True, exist_ok=True)
joblib.dump(artifact, model_output)

top_k = min(config["top_k"], len(books) - 1)
metrics = {
    "catalog_size": len(books),
    "vocabulary_size": len(vectorizer.vocabulary_),
    "mean_top_k_similarity": float(
        np.sort(similarity, axis=1)[:, -top_k:].mean()
    ),
}

metrics_output = Path(args.metrics_output)
metrics_output.parent.mkdir(parents=True, exist_ok=True)
metrics_output.write_text(json.dumps(metrics, indent=2), encoding="utf-8")

tracking_root = Path(__file__).resolve().parents[1] / "tracking"
tracking_root.mkdir(parents=True, exist_ok=True)

tracking_uri = os.getenv(
    "MLFLOW_TRACKING_URI",
    f"sqlite:///{(tracking_root / 'mlflow.db').resolve()}",
)
mlflow.set_tracking_uri(tracking_uri)

experiment = mlflow.get_experiment_by_name(config["experiment_name"])
if experiment is None:
    mlflow.create_experiment(
        config["experiment_name"],
        artifact_location=(tracking_root / "artifacts").resolve().as_uri(),
    )

mlflow.set_experiment(config["experiment_name"])

with mlflow.start_run(run_name=config["model_version"]):
    mlflow.log_params(
        {
            "ngram_range": str(tuple(config["ngram_range"])),
            "min_df": config["min_df"],
            "top_k": config["top_k"],
            "include_tags": config["include_tags"],
            "model_version": config["model_version"],
        }
    )
    mlflow.set_tags(
        {
            "model_type": "tfidf-cosine",
            "dataset_dvc_file": "ml/data/raw/public_books.csv.dvc",
        }
    )
    mlflow.log_metrics(metrics)
    mlflow.log_artifact(str(model_output), artifact_path="model")
    mlflow.log_artifact(str(metrics_output), artifact_path="reports")