import math
import pytest
from pathlib import Path
from app.recommender import RecommendationEngine
from scipy.sparse import csr_matrix
import numpy as np
import joblib

def create_mock_artifact(schema_version=2, include_sim=False, n=4, with_feature_matrix=True):
    catalog = [{"book_id": i * 10} for i in range(1, n + 1)]
    # Feature matrix features
    features = np.eye(n) # just identity for simplicity, dot product with self is 1, others 0
    # To test actual ranking, let's make it more interesting
    if n == 4:
        features = np.array([
            [1.0, 0.8, 0.2, 0.1], # book 10
            [0.8, 1.0, 0.9, 0.2], # book 20
            [0.2, 0.9, 1.0, 0.7], # book 30
            [0.1, 0.2, 0.7, 1.0], # book 40
        ])
    
    artifact = {
        "schema_version": schema_version,
        "model_version": "v1",
        "catalog": catalog,
    }
    if with_feature_matrix:
        artifact["feature_matrix"] = csr_matrix(features)
    if include_sim:
        artifact["similarity_matrix"] = features
    return artifact

def test_recommend_for_books_empty():
    engine = RecommendationEngine(Path("fake"))
    engine._feature_matrix = csr_matrix([[1.0, 0.5], [0.5, 1.0]])
    engine._book_positions = {1: 0, 2: 1}
    assert engine.recommend_for_books([], 5) == []

def test_recommend_for_books_valid():
    engine = RecommendationEngine(Path("fake"))
    engine.model_version = "v1"
    engine._catalog = [
        {"book_id": 10},
        {"book_id": 20},
        {"book_id": 30},
        {"book_id": 40},
    ]
    engine._book_positions = {10: 0, 20: 1, 30: 2, 40: 3}
    features = np.array([
        [1.0, 0.8, 0.2, 0.1], # book 10
        [0.8, 1.0, 0.9, 0.2], # book 20
        [0.2, 0.9, 1.0, 0.7], # book 30
        [0.1, 0.2, 0.7, 1.0], # book 40
    ])
    engine._feature_matrix = csr_matrix(features)

    recs = engine.recommend_for_books([10, 20], limit=5)
    assert len(recs) == 2
    assert recs[0].book_id == 30
    assert recs[1].book_id == 40

def test_recommend_for_books_duplicate_and_unknown():
    engine = RecommendationEngine(Path("fake"))
    engine.model_version = "v1"
    engine._catalog = [
        {"book_id": 10},
        {"book_id": 20},
        {"book_id": 30},
    ]
    engine._book_positions = {10: 0, 20: 1, 30: 2}
    features = np.array([
        [1.0, 0.8, 0.2],
        [0.8, 1.0, 0.9],
        [0.2, 0.9, 1.0],
    ])
    engine._feature_matrix = csr_matrix(features)

    recs = engine.recommend_for_books([10, 10, 99], limit=5)
    assert len(recs) == 2
    assert recs[0].book_id == 20
    assert recs[1].book_id == 30

def test_artifact_old_schema_rejected(tmp_path):
    artifact = create_mock_artifact(schema_version=1, include_sim=True, with_feature_matrix=False)
    p = tmp_path / "model.joblib"
    joblib.dump(artifact, p)
    
    engine = RecommendationEngine(p)
    with pytest.raises(ValueError, match="Artifact cũ có similarity_matrix bị reject"):
        engine.load()

def test_artifact_schema_v2_with_dense_rejected(tmp_path):
    artifact = create_mock_artifact(schema_version=2, include_sim=True)
    p = tmp_path / "model.joblib"
    joblib.dump(artifact, p)
    
    engine = RecommendationEngine(p)
    with pytest.raises(ValueError, match="Artifact mới không được có dense NxN matrix"):
        engine.load()

def test_recommend_top_k(tmp_path):
    artifact = create_mock_artifact(schema_version=2)
    p = tmp_path / "model.joblib"
    joblib.dump(artifact, p)
    
    engine = RecommendationEngine(p)
    engine.load()
    recs = engine.recommend(book_id=10, limit=2)
    assert len(recs) == 2
    assert recs[0].book_id == 20
    assert recs[1].book_id == 30

def test_synthetic_large_fixture(tmp_path):
    # Test 1000 items to ensure code uses sparse matrix properly
    n = 1000
    catalog = [{"book_id": i} for i in range(n)]
    
    # Create random sparse matrix
    from scipy.sparse import random
    feature_matrix = random(n, 100, density=0.1, format="csr")
    
    artifact = {
        "schema_version": 2,
        "model_version": "v2",
        "catalog": catalog,
        "feature_matrix": feature_matrix
    }
    
    p = tmp_path / "model.joblib"
    joblib.dump(artifact, p)
    
    engine = RecommendationEngine(p)
    engine.load()
    
    assert engine._feature_matrix.shape == (1000, 100)
    recs = engine.recommend(book_id=0, limit=5)
    assert len(recs) <= 5
