import logging
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import joblib
import numpy as np

LOGGER = logging.getLogger(__name__)


@dataclass(frozen=True)
class Recommendation:
    """Represent one recommendation returned by the trained catalog model."""

    book_id: int
    score: float
    model_version: str


class RecommendationEngine:
    """Load a fixed catalog artifact and rank similar books by cosine score."""

    def __init__(self, model_path: Path) -> None:
        self._model_path = model_path
        self._catalog: list[dict[str, Any]] = []
        self._book_positions: dict[int, int] = {}
        self._feature_matrix: Any = None
        self.model_version = ""

    def load(self) -> None:
        """Load and validate the DVC-materialized recommendation artifact."""
        if not self._model_path.is_file():
            raise FileNotFoundError(f"Model artifact not found: {self._model_path}")

        artifact = joblib.load(self._model_path)
        schema_version = artifact.get("schema_version")
        
        if schema_version != 2:
            raise ValueError(f"Unsupported artifact schema version: {schema_version}. Artifact cũ có similarity_matrix bị reject.")
            
        if "similarity_matrix" in artifact:
            raise ValueError("Artifact mới không được có dense NxN matrix (similarity_matrix).")

        catalog = artifact.get("catalog")
        feature_matrix = artifact.get("feature_matrix")
        model_version = artifact.get("model_version")

        if not isinstance(catalog, list) or not model_version:
            raise ValueError("Model artifact has an invalid catalog or version")

        if feature_matrix is None or feature_matrix.shape[0] != len(catalog):
            raise ValueError("Model artifact has an invalid feature matrix")

        book_positions: dict[int, int] = {}
        for position, book in enumerate(catalog):
            book_id = int(book["book_id"])
            if book_id in book_positions:
                raise ValueError(f"Duplicate book ID in model artifact: {book_id}")
            book_positions[book_id] = position

        self._catalog = catalog
        self._book_positions = book_positions
        self._feature_matrix = feature_matrix
        self.model_version = str(model_version)

        LOGGER.info(
            "Loaded recommendation model version %s with %s books",
            self.model_version,
            len(self._catalog),
        )

    def recommend(self, book_id: int, limit: int) -> list[Recommendation]:
        """Return top-ranked catalog books while excluding the source book."""
        if self._feature_matrix is None:
            raise RuntimeError("Recommendation model has not been loaded")

        source_position = self._book_positions.get(book_id)
        if source_position is None:
            raise KeyError(book_id)

        source_vector = self._feature_matrix[source_position]
        scores = source_vector.dot(self._feature_matrix.T).toarray().ravel()

        k = min(len(scores), limit + 1)
        if len(scores) > k:
            ranked_positions = np.argpartition(scores, -k)[-k:]
            ranked_positions = ranked_positions[np.argsort(scores[ranked_positions])[::-1]]
        else:
            ranked_positions = np.argsort(scores)[::-1]

        recommendations: list[Recommendation] = []
        for position in ranked_positions:
            candidate_book_id = int(self._catalog[int(position)]["book_id"])
            score = float(scores[int(position)])

            if candidate_book_id == book_id or not math.isfinite(score) or score < 0:
                continue

            recommendations.append(
                Recommendation(
                    book_id=candidate_book_id,
                    score=score,
                    model_version=self.model_version,
                )
            )

            if len(recommendations) == limit:
                break

        return recommendations

    def recommend_for_books(
        self,
        book_ids: list[int],
        limit: int,
    ) -> list[Recommendation]:
        if self._feature_matrix is None:
            raise RuntimeError("Recommendation model has not been loaded")

        source_positions = [
            self._book_positions[book_id]
            for book_id in dict.fromkeys(book_ids)
            if book_id in self._book_positions
        ]
        if not source_positions:
            return []

        profile_vector = self._feature_matrix[source_positions].mean(axis=0)
        norm = np.linalg.norm(profile_vector)
        if norm > 0:
            profile_vector = profile_vector / norm
            
        scores = self._feature_matrix.dot(np.asarray(profile_vector).T).ravel()
        excluded = set(source_positions)

        k = min(len(scores), limit + len(excluded))
        if len(scores) > k:
            ranked_positions = np.argpartition(scores, -k)[-k:]
            ranked_positions = ranked_positions[np.argsort(scores[ranked_positions])[::-1]]
        else:
            ranked_positions = np.argsort(scores)[::-1]

        recommendations = []
        for position in ranked_positions:
            position = int(position)
            score = float(scores[position])
            if position in excluded or not math.isfinite(score) or score < 0:
                continue

            recommendations.append(
                Recommendation(
                    book_id=int(self._catalog[position]["book_id"]),
                    score=score,
                    model_version=self.model_version,
                )
            )
            if len(recommendations) == limit:
                break

        return recommendations