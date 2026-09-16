FROM python:3.11.11-slim AS builder

WORKDIR /build

COPY ml/recommendation-service/requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt


FROM python:3.11.11-slim AS runner

WORKDIR /app

RUN groupadd --gid 1001 appuser \
    && useradd --uid 1001 --gid 1001 --create-home appuser

COPY --from=builder /install /usr/local
COPY ml/recommendation-service/app /app/app
COPY ml/models/tfidf_recommender.joblib /app/model/tfidf_recommender.joblib

RUN chown -R appuser:appuser /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    MODEL_PATH=/app/model/tfidf_recommender.joblib

USER 1001:1001

EXPOSE 8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]