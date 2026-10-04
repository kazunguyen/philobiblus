import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# DATABASE_URL is deployment-specific and must be provided by the environment.
DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is required")


def _int_env(name: str, default: int, minimum: int) -> int:
    raw_value = os.getenv(name, str(default))
    try:
        value = int(raw_value)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be an integer") from exc
    if value < minimum:
        raise RuntimeError(f"{name} must be at least {minimum}")
    return value


engine_options = {}
if DATABASE_URL.startswith(("postgresql://", "postgresql+psycopg2://")):
    engine_options = {
        "pool_size": _int_env("DATABASE_POOL_SIZE", 3, 1),
        "max_overflow": _int_env("DATABASE_MAX_OVERFLOW", 2, 0),
        "pool_timeout": _int_env("DATABASE_POOL_TIMEOUT_SECONDS", 10, 1),
        "pool_recycle": _int_env("DATABASE_POOL_RECYCLE_SECONDS", 1800, 1),
        "pool_pre_ping": True,
    }

engine = create_engine(DATABASE_URL, **engine_options)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency injection to provide a database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
