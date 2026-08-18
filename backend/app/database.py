import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Lấy DATABASE_URL từ biến môi trường, mặc định trỏ vào localhost cho local dev
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/philobiblus_db",
)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency injection để mở và đóng database session tự động cho mỗi request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()