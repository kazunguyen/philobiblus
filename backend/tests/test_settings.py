def test_get_settings_creates_default_settings(client, auth_headers):
    response = client.get("/api/settings", headers=auth_headers)

    assert response.status_code == 200
    assert response.json()["theme"] == "light"
    assert response.json()["default_book_view"] == "grid"


def test_update_settings_persists_settings(client, auth_headers):
    update_response = client.put(
        "/api/settings",
        json={"theme": "dark", "default_book_view": "list"},
        headers=auth_headers,
    )

    assert update_response.status_code == 200
    assert update_response.json()["theme"] == "dark"
    assert update_response.json()["default_book_view"] == "list"

    get_response = client.get("/api/settings", headers=auth_headers)
    assert get_response.json()["theme"] == "dark"
    assert get_response.json()["default_book_view"] == "list"


def test_settings_are_isolated_between_users(
    client,
    auth_headers,
    second_auth_headers,
):
    client.put(
        "/api/settings",
        json={"theme": "dark"},
        headers=auth_headers,
    )

    response = client.get("/api/settings", headers=second_auth_headers)

    assert response.status_code == 200
    assert response.json()["theme"] == "light"
    assert response.json()["default_book_view"] == "grid"
