"""Call the internal recommendation service with a bounded timeout."""

import logging
import math
import os
from dataclasses import dataclass
from typing import Any

import httpx

logger = logging.getLogger(__name__)

RECOMMENDATION_SERVICE_URL = os.environ.get(
    "RECOMMENDATION_SERVICE_URL",
    "http://127.0.0.1:8081",
).rstrip("/")
RECOMMENDATION_TIMEOUT_SECONDS = float(
    os.environ.get("RECOMMENDATION_TIMEOUT_SECONDS", "2")
)


@dataclass(frozen=True)
class ModelRecommendation:
    """Represent one validated result from the model service."""

    book_id: int
    score: float
    model_version: str


def fetch_recommendations(
    book_id: int,
    limit: int,
) -> list[ModelRecommendation]:
    """Return model recommendations, or an empty list when unavailable."""
    url = (
        f"{RECOMMENDATION_SERVICE_URL}"
        f"/recommendations/books/{book_id}"
    )

    try:
        response = httpx.get(
            url,
            params={"limit": limit},
            timeout=RECOMMENDATION_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        payload = response.json()
    except (httpx.HTTPError, ValueError) as error:
        logger.warning("Recommendation service is unavailable: %s", error)
        return []

    if not isinstance(payload, list):
        logger.warning("Recommendation service returned an invalid payload")
        return []

    recommendations = [
        recommendation
        for item in payload
        if (
            recommendation := _parse_recommendation(item)
        ) is not None
    ]
    return recommendations


def _parse_recommendation(item: Any) -> ModelRecommendation | None:
    """Validate one untrusted recommendation-service response item."""
    if not isinstance(item, dict):
        return None

    book_id = item.get("book_id")
    score = item.get("score")
    model_version = item.get("model_version")

    if (
        not isinstance(book_id, int)
        or isinstance(book_id, bool)
        or not isinstance(score, (int, float))
        or not isinstance(model_version, str)
        or not model_version
    ):
        return None

    normalized_score = float(score)
    if normalized_score < 0 or not math.isfinite(normalized_score):
        return None

    return ModelRecommendation(
        book_id=book_id,
        score=normalized_score,
        model_version=model_version,
    )