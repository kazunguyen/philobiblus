FROM python:3.11-slim

WORKDIR /app

COPY requirements-training.txt .
RUN pip install --no-cache-dir -r requirements-training.txt

# We rely on Workload Identity for credentials.
# No service account keys are embedded.
COPY . /app

# The entrypoint for the training job
ENTRYPOINT ["python", "src/pipeline.py"]
