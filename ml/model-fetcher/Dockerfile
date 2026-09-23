FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir google-cloud-storage joblib scipy numpy

COPY fetch_model.py /app/fetch_model.py

RUN groupadd --gid 1001 appuser \
    && useradd --uid 1001 --gid 1001 --create-home appuser \
    && chown -R appuser:appuser /app

USER 1001:1001

ENTRYPOINT ["python", "/app/fetch_model.py"]
