import pytest
from fastapi.testclient import TestClient
from pathlib import Path
from unittest.mock import patch, MagicMock

from app.main import create_app

@pytest.fixture
def mock_engine():
    with patch("app.main.RecommendationEngine") as MockEngine:
        engine_instance = MockEngine.return_value
        engine_instance.model_version = "tfidf-v2-mock"
        yield engine_instance

def test_health_check_returns_model_version(mock_engine):
    app = create_app(Path("fake_model.joblib"))
    
    with TestClient(app) as client:
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok", "model_version": "tfidf-v2-mock"}
        mock_engine.load.assert_called_once()
