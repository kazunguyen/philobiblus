"""Evaluate the fixed catalog model on time-ordered reading interactions."""

import argparse
import json
import logging
import sys
from pathlib import Path

import pandas as pd
import sqlalchemy
from sqlalchemy import text

# The training image keeps the serving package beside src/, rather than installing it.
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "recommendation-service"))
from app.recommender import RecommendationEngine  # noqa: E402


QUERY_INTERACTIONS = """
SELECT bp.user_id, bp.book_id, COALESCE(bp.date_started, bp.created_at) AS interaction_time
FROM book_reading_progress bp JOIN books b ON bp.book_id = b.id
WHERE b.visibility = 'public'
"""
LOGGER = logging.getLogger(__name__)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db-uri", required=True)
    parser.add_argument("--model-path", required=True)
    parser.add_argument("--output-metrics", required=True)
    parser.add_argument("--top-k", type=int, default=5)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    model_path = Path(args.model_path)
    if not model_path.is_file():
        raise FileNotFoundError(f"Model not found: {model_path}")
    recommender = RecommendationEngine(model_path)
    recommender.load()
    db_engine = sqlalchemy.create_engine(args.db_uri, isolation_level="REPEATABLE READ")
    with db_engine.begin() as connection:
        interactions = pd.read_sql_query(text(QUERY_INTERACTIONS), connection)
    interactions = interactions.dropna(subset=["user_id", "book_id", "interaction_time"])
    eligible = interactions[interactions["user_id"].map(interactions["user_id"].value_counts()) >= 2]
    eligible = eligible.sort_values(["user_id", "interaction_time", "book_id"])
    hits, reciprocal_rank, profiles, recommended_items = 0, 0.0, 0, set()
    for _, group in eligible.groupby("user_id", sort=False):
        book_ids = [int(book_id) for book_id in group["book_id"]]
        target, profile = book_ids[-1], book_ids[:-1]
        recommendations = recommender.recommend_for_books(profile, limit=args.top_k)
        if not recommendations:
            continue
        profiles += 1
        recommendation_ids = [item.book_id for item in recommendations]
        recommended_items.update(recommendation_ids)
        if target in recommendation_ids:
            hits += 1
            reciprocal_rank += 1 / (recommendation_ids.index(target) + 1)
    metrics = {
        f"hit_rate_at_{args.top_k}": hits / profiles if profiles else 0.0,
        f"recall_at_{args.top_k}": hits / profiles if profiles else 0.0,
        f"mrr_at_{args.top_k}": reciprocal_rank / profiles if profiles else 0.0,
        f"catalog_coverage_at_{args.top_k}": len(recommended_items) / len(recommender._catalog) if recommender._catalog else 0.0,
        "evaluated_profiles": profiles,
    }
    output = Path(args.output_metrics)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    LOGGER.info("Evaluation metrics: %s", metrics)


if __name__ == "__main__":
    main()
