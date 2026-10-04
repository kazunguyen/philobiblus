import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

from app.database import Base, engine
from app.observability import configure_observability
from app.routers import admin, auth, books, reviews, social, users, reading_history, settings, uploads

api_docs_enabled = os.environ.get("ENABLE_API_DOCS", "false").strip().lower() in {
    "1",
    "true",
    "yes",
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Automatically create database tables on startup if they do not exist, try if database reachable
    try:
        Base.metadata.create_all(bind=engine)
    except Exception:
        pass
    # Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="Philobiblus API",
    description="A full-stack personal book tracking and reading progress management API.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if api_docs_enabled else None,
    redoc_url="/redoc" if api_docs_enabled else None,
    openapi_url="/openapi.json" if api_docs_enabled else None,
)

# Configure correlation and traces before routers are registered.
configure_observability(app, engine)

# Configure CORS for Frontend integration (React / Vite). The allowed origins
# vary by deployment and must be provided by the environment.
allowed_origins = os.environ.get("ALLOWED_ORIGINS")
if not allowed_origins:
    raise RuntimeError("ALLOWED_ORIGINS environment variable is required")
origins = [origin.strip() for origin in allowed_origins.split(",") if origin.strip()]
if not origins:
    raise RuntimeError("ALLOWED_ORIGINS must contain at least one origin")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# Metrics remain reachable only through the backend ClusterIP Service. The
# instrumentator uses FastAPI route templates, avoiding labels with user IDs or
# usernames that would create unbounded Prometheus time-series cardinality.
Instrumentator(
    should_group_status_codes=False,
    should_ignore_untemplated=True,
    excluded_handlers=["/metrics"],
).instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)

# Include API routers
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(books.router)
app.include_router(users.router)
app.include_router(reviews.router)
app.include_router(social.router)
app.include_router(reading_history.router)
app.include_router(settings.router)
app.include_router(uploads.router)


@app.get("/", tags=["General"])
def root():
    """Root endpoint returning service status."""
    return {
        "name": "Philobiblus API",
        "version": "1.0.0",
        "status": "healthy",
        "docs_url": "/docs" if api_docs_enabled else None,
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint for Kubernetes liveness and readiness probes."""
    return {"status": "ok"}
