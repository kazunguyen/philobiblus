def test_get_user_profile_returns_safe_public_data(client, auth_headers):
    """Test public user profile returns safe user fields and book list."""
    client.post(
        "/api/books",
        json={
            "title": "Atomic Habits",
            "author": "James Clear",
            "genre": "Self Improvement",
        },
        headers=auth_headers,
    )

    response = client.get("/api/users/testuser")

    assert response.status_code == 200
    data = response.json()

    assert data["user"]["username"] == "testuser"
    assert "created_at" in data["user"]
    assert "email" not in data["user"]
    assert "hashed_password" not in data["user"]

    assert len(data["books"]) == 1
    assert data["books"][0]["title"] == "Atomic Habits"


def test_get_user_profile_not_found(client):
    """Test requesting a missing user profile returns 404."""
    response = client.get("/api/users/missinguser")

    assert response.status_code == 404
    assert response.json()["detail"] == "User not found"