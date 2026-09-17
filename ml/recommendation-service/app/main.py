import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from prometheus_client import Counter, Gauge
from prometheus_fastapi_instrumentator import Instrumentator
from pydantic import BaseModel, Field

from app.recommender import RecommendationEngine


MODEL_INFO = Gauge(
    "philobiblus_recommendation_model_info",
    "Loaded recommendation model version.",
    ["model_version"],
)

REQUESTS_TOTAL = Counter(
    "philobiblus_recommendation_requests_total",
    "Recommendation requests grouped by bounded outcome.",
    ["outcome"],
)


class UserProfileRecommendationIn(BaseModel):
    book_ids: list[int] = Field(min_length=1, max_length=100)
    limit: int = Field(default=5, ge=1, le=5)

class RecommendationOut(BaseModel):
    """Return one model-ranked book without private catalog metadata."""

    book_id: int
    score: float = Field(ge=0)
    model_version: str


def create_app(model_path: Path) -> FastAPI:
    """Create a recommendation API bound to one immutable model artifact."""
    engine = RecommendationEngine(model_path)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        engine.load()
        MODEL_INFO.labels(model_version=engine.model_version).set(1)
        yield
        MODEL_INFO.labels(model_version=engine.model_version).set(0)

    app = FastAPI(
        title="Philobiblus Recommendation Service",
        version="1.0.0",
        lifespan=lifespan,
    )

    Instrumentator(
        should_group_status_codes=False,
        should_ignore_untemplated=True,
        excluded_handlers=["/metrics"],
    ).instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)

    @app.get("/health")
    def health_check() -> dict[str, str]:
        """Report readiness only after the trained model has loaded."""
        return {"status": "ok", "model_version": engine.model_version}

    @app.get(
        "/recommendations/books/{book_id}",
        response_model=list[RecommendationOut],
    )
    def get_recommendations(
        book_id: int,
        limit: int = Query(default=5, ge=1, le=5),
    ) -> list[RecommendationOut]:
        """Rank catalog-similar books for one public source-book ID."""
        try:
            recommendations = engine.recommend(book_id=book_id, limit=limit)
        except KeyError as error:
            REQUESTS_TOTAL.labels(outcome="not_found").inc()
            raise HTTPException(status_code=404, detail="Book is not in model catalog") from error

        REQUESTS_TOTAL.labels(outcome="success").inc()
        return [
            RecommendationOut(
                book_id=item.book_id,
                score=item.score,
                model_version=item.model_version,
            )
            for item in recommendations
        ]

    @app.post(
        "/recommendations/profiles",
        response_model=list[RecommendationOut],
    )
    def get_profile_recommendations(
        request: UserProfileRecommendationIn,
    ) -> list[RecommendationOut]:
        items = engine.recommend_for_books(request.book_ids, request.limit)
        return [RecommendationOut(**item.__dict__) for item in items]

    return app



model_path = Path(
    os.environ.get(
        "MODEL_PATH",
        "/app/model/tfidf_recommender.joblib",
    )
)

app = create_app(model_path)