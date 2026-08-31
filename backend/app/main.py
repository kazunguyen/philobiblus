import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routers import auth, books, reviews, users


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
)

# Configure CORS for Frontend integration (React / Vite)
origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000,http://localhost:80",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(auth.router)
app.include_router(books.router)
app.include_router(users.router)
app.include_router(reviews.router)


@app.get("/", tags=["General"])
def root():
    """Root endpoint returning service status."""
    return {
        "name": "Philobiblus API",
        "version": "1.0.0",
        "status": "healthy",
        "docs_url": "/docs",
    }


@app.get("/health", tags=["Health"])
def health_check():
    """Health check endpoint for Kubernetes liveness and readiness probes."""
    return {"status": "ok"}
