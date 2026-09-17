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
        self._similarity: np.ndarray | None = None
        self.model_version = ""

    def load(self) -> None:
        """Load and validate the DVC-materialized recommendation artifact."""
        if not self._model_path.is_file():
            raise FileNotFoundError(f"Model artifact not found: {self._model_path}")

        artifact = joblib.load(self._model_path)
        catalog = artifact.get("catalog")
        similarity = np.asarray(artifact.get("similarity_matrix"))
        model_version = artifact.get("model_version")

        if not isinstance(catalog, list) or not model_version:
            raise ValueError("Model artifact has an invalid catalog or version")

        if similarity.ndim != 2 or similarity.shape != (len(catalog), len(catalog)):
            raise ValueError("Model artifact has an invalid similarity matrix")

        book_positions: dict[int, int] = {}
        for position, book in enumerate(catalog):
            book_id = int(book["book_id"])
            if book_id in book_positions:
                raise ValueError(f"Duplicate book ID in model artifact: {book_id}")
            book_positions[book_id] = position

        self._catalog = catalog
        self._book_positions = book_positions
        self._similarity = similarity
        self.model_version = str(model_version)

        LOGGER.info(
            "Loaded recommendation model version %s with %s books",
            self.model_version,
            len(self._catalog),
        )

    def recommend(self, book_id: int, limit: int) -> list[Recommendation]:
        """Return top-ranked catalog books while excluding the source book."""
        if self._similarity is None:
            raise RuntimeError("Recommendation model has not been loaded")

        source_position = self._book_positions.get(book_id)
        if source_position is None:
            raise KeyError(book_id)

        scores = self._similarity[source_position]
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
        if self._similarity is None:
            raise RuntimeError("Recommendation model has not been loaded")

        source_positions = [
            self._book_positions[book_id]
            for book_id in dict.fromkeys(book_ids)
            if book_id in self._book_positions
        ]
        if not source_positions:
            return []

        scores = self._similarity[source_positions].mean(axis=0)
        excluded = set(source_positions)
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