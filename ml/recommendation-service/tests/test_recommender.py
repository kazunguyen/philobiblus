import math
import pytest
from pathlib import Path
from app.recommender import RecommendationEngine

# Tests for recommend_for_books
def test_recommend_for_books_empty():
    engine = RecommendationEngine(Path("fake"))
    engine._similarity = [[1.0, 0.5], [0.5, 1.0]]
    engine._book_positions = {1: 0, 2: 1}
    assert engine.recommend_for_books([], 5) == []

def test_recommend_for_books_valid():
    import numpy as np
    engine = RecommendationEngine(Path("fake"))
    engine.model_version = "v1"
    engine._catalog = [
        {"book_id": 10},
        {"book_id": 20},
        {"book_id": 30},
        {"book_id": 40},
    ]
    engine._book_positions = {10: 0, 20: 1, 30: 2, 40: 3}
    # similarity matrix
    engine._similarity = np.array([
        [1.0, 0.8, 0.2, 0.1], # book 10
        [0.8, 1.0, 0.9, 0.2], # book 20
        [0.2, 0.9, 1.0, 0.7], # book 30
        [0.1, 0.2, 0.7, 1.0], # book 40
    ])

    recs = engine.recommend_for_books([10, 20], limit=5)
    assert len(recs) == 2
    assert recs[0].book_id == 30
    assert abs(recs[0].score - 0.55) < 1e-5
    assert recs[1].book_id == 40
    assert abs(recs[1].score - 0.15) < 1e-5

def test_recommend_for_books_duplicate_and_unknown():
    import numpy as np
    engine = RecommendationEngine(Path("fake"))
    engine.model_version = "v1"
    engine._catalog = [
        {"book_id": 10},
        {"book_id": 20},
        {"book_id": 30},
    ]
    engine._book_positions = {10: 0, 20: 1, 30: 2}
    engine._similarity = np.array([
        [1.0, 0.8, 0.2],
        [0.8, 1.0, 0.9],
        [0.2, 0.9, 1.0],
    ])

    recs = engine.recommend_for_books([10, 10, 99], limit=5)
    assert len(recs) == 2
    assert recs[0].book_id == 20
    assert recs[1].book_id == 30
