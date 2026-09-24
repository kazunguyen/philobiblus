FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements-training.txt .
RUN pip install --no-cache-dir -r requirements-training.txt \
    && useradd --system --uid 10001 --create-home trainer
COPY --chown=10001:10001 . /app
USER 10001
# Workload Identity supplies short-lived Google credentials; no key is copied.
ENTRYPOINT ["python", "src/pipeline.py"]
