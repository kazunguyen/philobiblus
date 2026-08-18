import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth import get_password_hash
from app.database import Base, get_db
from app.main import app
from app.models import User

# Configure SQLite in-memory database for fast and isolated test executions
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    """Create a fresh database schema for each test, then drop all tables."""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    """Override get_db dependency in FastAPI app to use the test database session."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def test_user(db_session):
    """Create and return a default test user."""
    user = User(
        username="testuser",
        email="testuser@example.com",
        hashed_password=get_password_hash("password123"),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def auth_headers(client, test_user):
    """Authenticate default test user and return Bearer token headers."""
    response = client.post(
        "/api/auth/login",
        data={"username": "testuser", "password": "password123"},
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def second_auth_headers(client, db_session):
    """Create and authenticate a second test user to verify data isolation."""
    second_user = User(
        username="seconduser",
        email="seconduser@example.com",
        hashed_password=get_password_hash("password456"),
    )
    db_session.add(second_user)
    db_session.commit()
    db_session.refresh(second_user)

    response = client.post(
        "/api/auth/login",
        data={"username": "seconduser", "password": "password456"},
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}