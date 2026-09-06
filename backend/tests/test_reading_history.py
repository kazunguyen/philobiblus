def test_progress_changes_create_reading_history(client, auth_headers):
    """Test progress edits create automatic timestamped snapshots."""
    book_response = client.post(
        "/api/books",
        json={
            "title": "Reading History Book",
            "author": "Author",
            "genre": "Tech",
            "pages_total": 300,
        },
        headers=auth_headers,
    )
    book_id = book_response.json()["id"]

    update_response = client.put(
        f"/api/books/{book_id}",
        json={"pages_read": 80, "chapters_read": 2.5, "volume": 1},
        headers=auth_headers,
    )

    assert update_response.status_code == 200

    response = client.get(
        f"/api/books/{book_id}/reading-history",
        headers=auth_headers,
    )

    assert response.status_code == 200
    entry = response.json()[0]
    assert entry["pages_read"] == 80
    assert entry["chapters_read"] == 2.5
    assert entry["volume"] == 1
    assert entry["recorded_at"] is not None


def test_reading_history_is_not_created_without_progress_change(
    client,
    auth_headers,
):
    """Test non-progress edits do not create history entries."""
    book_response = client.post(
        "/api/books",
        json={
            "title": "No History Book",
            "author": "Author",
            "genre": "Tech",
        },
        headers=auth_headers,
    )
    book_id = book_response.json()["id"]

    client.put(
        f"/api/books/{book_id}",
        json={"notes": "Updated note"},
        headers=auth_headers,
    )

    response = client.get(
        f"/api/books/{book_id}/reading-history",
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json() == []
