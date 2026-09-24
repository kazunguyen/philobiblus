FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements-mlflow.txt .
RUN pip install --no-cache-dir -r requirements-mlflow.txt \
    && useradd --system --uid 10001 --create-home mlflow
USER 10001
ENTRYPOINT ["mlflow"]
