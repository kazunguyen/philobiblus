import argparse
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import yaml
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


parser = argparse.ArgumentParser()
parser.add_argument("--input", required=True)
parser.add_argument("--params", required=True)
parser.add_argument("--model-output", required=True)
parser.add_argument("--metrics-output", required=True)
args = parser.parse_args()

with open(args.params, encoding="utf-8") as file:
    config = yaml.safe_load(file)["train"]

books = pd.read_csv(args.input)

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