import pytest
from app.models import BookStatus, BookVisibility

def test_for_me_requires_auth(client):
    response = client.get("/api/books/recommendations/for-me")
    assert response.status_code == 401

def test_for_me_fallback_on_unavailable_model(client, auth_headers):
    # If the model is not mocked or unavailable, it should fallback to catalog_fallback
    response = client.get("/api/books/recommendations/for-me", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["source"] == "catalog_fallback"
    assert "books" in data
