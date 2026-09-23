import argparse
import json
import logging
import sys
from pathlib import Path

import pandas as pd
import sqlalchemy
from sqlalchemy import text

# Import our recommender engine (assuming we have PYTHONPATH set)
from app.recommender import RecommendationEngine

logging.basicConfig(level=logging.INFO)
LOGGER = logging.getLogger(__name__)

QUERY_INTERACTIONS = """
SELECT
    bp.user_id,
    bp.book_id,
    COALESCE(bp.date_started, bp.created_at) AS interaction_time
FROM book_reading_progress bp
JOIN books b ON bp.book_id = b.id
WHERE b.visibility = 'public'
"""

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--db-uri", required=True, help="PostgreSQL connection URI for reading interactions")
    parser.add_argument("--model-path", required=True, help="Path to the model.joblib artifact")
    parser.add_argument("--output-metrics", required=True, help="Path to write evaluation metrics JSON")
    args = parser.parse_args()

    model_path = Path(args.model_path)
    if not model_path.is_file():
        LOGGER.error(f"Model not found: {model_path}")
        sys.exit(1)

    engine = RecommendationEngine(model_path)
    try:
        engine.load()
    except Exception as e:
        LOGGER.error(f"Failed to load model: {e}")
        sys.exit(1)

    db_engine = sqlalchemy.create_engine(
        args.db_uri,
        isolation_level="REPEATABLE READ"
    )

    with db_engine.begin() as conn:
        df = pd.read_sql_query(text(QUERY_INTERACTIONS), conn)

    # Time-based holdout
    # 1. Chọn profile có ít nhất 2 interaction với public book.
    user_counts = df["user_id"].value_counts()
    valid_users = user_counts[user_counts >= 2].index
    df = df[df["user_id"].isin(valid_users)].copy()

    # 2. Sắp theo thời điểm bắt đầu/hoàn thành đọc.
    df = df.sort_values(["user_id", "interaction_time"])

    hit_count = 0
    mrr_sum = 0.0
    evaluated_profiles = 0
    recommended_items = set()

    # evaluate per user
    for user_id, group in df.groupby("user_id"):
        book_ids = group["book_id"].tolist()
        
        # 3. Dùng các sách trước làm profile, 4. Hide sách kế tiếp làm target.
        # We can use all but the last as profile, and the last as target
        profile_books = book_ids[:-1]
        target_book = book_ids[-1]

        try:
            # 5. Tính top-5 và đo target có nằm trong top-5 hay không.
            recommendations = engine.recommend_for_books(profile_books, limit=5)
            evaluated_profiles += 1
            
            rec_ids = [r.book_id for r in recommendations]
            recommended_items.update(rec_ids)
            
            if target_book in rec_ids:
                hit_count += 1
                rank = rec_ids.index(target_book) + 1
                mrr_sum += 1.0 / rank
                
        except Exception as e:
            LOGGER.warning(f"Failed to recommend for user {user_id}: {e}")

    hit_rate_at_5 = hit_count / evaluated_profiles if evaluated_profiles > 0 else 0.0
    mrr_at_5 = mrr_sum / evaluated_profiles if evaluated_profiles > 0 else 0.0
    catalog_coverage_at_5 = len(recommended_items) / len(engine._catalog) if len(engine._catalog) > 0 else 0.0

    metrics = {
        "hit_rate_at_5": float(hit_rate_at_5),
        "recall_at_5": float(hit_rate_at_5),  # Since we only have 1 target, hit rate == recall
        "mrr_at_5": float(mrr_at_5),
        "catalog_coverage_at_5": float(catalog_coverage_at_5),
        "evaluated_profiles": int(evaluated_profiles),
    }

    out_path = Path(args.output_metrics)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(metrics, f, indent=2)

    LOGGER.info(f"Evaluation metrics: {metrics}")

if __name__ == "__main__":
    main()
