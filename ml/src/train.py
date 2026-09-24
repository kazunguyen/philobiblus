"""Train the sparse catalog recommender; experiment logging is a later pipeline step."""

import argparse
import json
import os
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import yaml
from sklearn.feature_extraction.text import TfidfVectorizer


def sampled_mean_top_k(matrix, top_k: int, sample_size: int) -> float:
    """Bound diagnostics to O(sample_size * catalog_size), never O(N²)."""
    if matrix.shape[0] < 2 or top_k <= 0:
        return 0.0
    sample_count = min(matrix.shape[0], sample_size)
    positions = np.random.default_rng(0).choice(matrix.shape[0], size=sample_count, replace=False)
    means: list[float] = []
    for position in positions:
        scores = matrix[position].dot(matrix.T).toarray().ravel()
        scores[position] = -np.inf
        effective_k = min(top_k, len(scores) - 1)
        means.append(float(np.partition(scores, -effective_k)[-effective_k:].mean()))
    return float(np.mean(means))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--params", required=True)
    parser.add_argument("--model-output", required=True)
    parser.add_argument("--metrics-output", required=True)
    args = parser.parse_args()
    config = yaml.safe_load(Path(args.params).read_text(encoding="utf-8"))["train"]
    books = pd.read_csv(args.input)
    feature_columns = ["title", "author", "genre"] + (["tags_text"] if config["include_tags"] else [])
    books["feature_text"] = books[feature_columns].fillna("").astype(str).agg(" ".join, axis=1).str.lower()
    vectorizer = TfidfVectorizer(ngram_range=tuple(config["ngram_range"]), min_df=config["min_df"])
    feature_matrix = vectorizer.fit_transform(books["feature_text"])
    artifact = {
        "schema_version": 2,
        "model_version": config["model_version"],
        "snapshot_id": os.environ.get("SNAPSHOT_ID", "local-dev"),
        "vectorizer": vectorizer,
        "feature_matrix": feature_matrix,
        "catalog": books[["book_id", "title", "author", "genre", "cover_url"]].to_dict(orient="records"),
    }
    model_output = Path(args.model_output)
    model_output.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(artifact, model_output)
    metrics = {
        "catalog_size": int(len(books)),
        "vocabulary_size": int(len(vectorizer.vocabulary_)),
        "mean_top_k_similarity": sampled_mean_top_k(
            feature_matrix, int(config["top_k"]), int(config.get("diagnostic_sample_size", 200))
        ),
    }
    metrics_output = Path(args.metrics_output)
    metrics_output.parent.mkdir(parents=True, exist_ok=True)
    metrics_output.write_text(json.dumps(metrics, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
