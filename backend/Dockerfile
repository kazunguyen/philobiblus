# ==========================================
# Stage 1: Build dependencies (Builder Stage)
# ==========================================
FROM python:3.11-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies to local user directory
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt


# ==========================================
# Stage 2: Final Runtime Image (Minimal & Secure)
# ==========================================
FROM python:3.11-slim AS runner

WORKDIR /app

# Install PostgreSQL runtime library and curl for healthchecks
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security best practices (DevSecOps)
RUN groupadd -g 1001 appuser && \
    useradd -u 1001 -g appuser -m -s /bin/bash appuser

# Copy installed packages from builder stage
COPY --from=builder /root/.local /home/appuser/.local

# Copy application source code
COPY ./app /app/app

# Copy utility scripts used by one-off Docker Compose jobs
COPY ./scripts /app/scripts

# Set ownership of app directory to non-root user
RUN chown -R appuser:appuser /app

# Configure non-network environment variables. APP_HOST and APP_PORT are
# deployment inputs and are intentionally not given image-level defaults.
ENV PATH=/home/appuser/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Switch to non-root user
USER appuser

# Start FastAPI application with Uvicorn
CMD ["sh", "-c", "exec uvicorn app.main:app --host \"$APP_HOST\" --port \"$APP_PORT\""]
